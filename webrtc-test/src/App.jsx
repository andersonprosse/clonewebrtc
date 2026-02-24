import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

const socket = io('https://webrtc-signaling-server.onrender.com', {
  transports: ['websocket'],
  upgrade: false
});

export default function App() {
  const [inCall, setInCall] = useState(false);
  const [bridgeIp, setBridgeIp] = useState("192.168.0.103:8081"); 
  const [status, setStatus] = useState({ type: 'info', msg: 'Aguardando IP...' });
  
  const videoRef = useRef();
  const canvasRef = useRef(document.createElement("canvas"));
  const requestRef = useRef();
  const pc = useRef(new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  }));

  useEffect(() => {
    socket.on('connect', () => setStatus({ type: 'success', msg: 'Servidor Online 🚀' }));
    
    // Receptor: Quando o vídeo chega do outro lado
    pc.current.ontrack = (e) => {
      setInCall(true);
      if (videoRef.current) videoRef.current.srcObject = e.streams[0];
    };

    // Sinalização básica
    socket.on('user-joined', async () => {
      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);
      socket.emit('signal', { to: 'sala-1', signal: { sdp: offer } });
    });

    socket.on('signal', async (data) => {
      if (data.signal.sdp) {
        await pc.current.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
        if (data.signal.sdp.type === 'offer') {
          const answer = await pc.current.createAnswer();
          await pc.current.setLocalDescription(answer);
          socket.emit('signal', { to: 'sala-1', signal: { sdp: answer } });
        }
      } else if (data.signal.candidate) {
        await pc.current.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
      }
    });

    pc.current.onicecandidate = (e) => {
      if (e.candidate) socket.emit('signal', { to: 'sala-1', signal: { candidate: e.candidate } });
    };

    return () => socket.off();
  }, []);

  const startBridge = () => {
    setStatus({ type: 'info', msg: 'Conectando...' });
    const img = new Image();
    // A URL mais simples possível: só o IP
    img.src = `http://${bridgeIp}/video`;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = 640; 
    canvas.height = 480;

    img.onload = () => {
      const render = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        requestRef.current = requestAnimationFrame(render);
      };
      render();

      const stream = canvas.captureStream(15);
      stream.getTracks().forEach(track => pc.current.addTrack(track, stream));
      socket.emit('join-room', 'sala-1');
      setInCall(true);
      setStatus({ type: 'success', msg: 'Transmitindo!' });
    };

    img.onerror = () => setStatus({ type: 'error', msg: 'Erro: Verifique o IP e o Cadeado' });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 flex flex-col items-center">
      <h1 className="text-xl font-bold mb-4">Digital Connect BRIDGE</h1>
      
      {!inCall ? (
        <div className="w-full max-w-sm space-y-4">
          <input 
            className="w-full p-3 bg-slate-900 border border-slate-700 rounded-lg"
            value={bridgeIp}
            onChange={(e) => setBridgeIp(e.target.value)}
            placeholder="IP (Ex: 192.168.0.103:8081)"
          />
          <button onClick={startBridge} className="w-full p-4 bg-blue-600 rounded-lg font-bold">
            CONECTAR CÂMERA
          </button>
        </div>
      ) : (
        <div className="w-full max-w-2xl">
          <video ref={videoRef} autoPlay playsInline className="w-full border-2 border-blue-500 rounded-xl bg-black" />
        </div>
      )}
      <p className="mt-4 text-xs font-mono">{status.msg}</p>
    </div>
  );
}