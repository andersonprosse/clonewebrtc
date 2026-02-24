import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

// Substitua o bloco antigo por este:
const socket = io('https://webrtc-signaling-server.onrender.com', {
  transports: ['websocket'], // Mantemos isso para evitar erros de conexão inicial
  upgrade: false
});

export default function App() {
  const [inCall, setInCall] = useState(false);
  const [bridgeIp, setBridgeIp] = useState("192.168.0.XX:8081"); 
  const [auth, setAuth] = useState("admin:1234");
  const [status, setStatus] = useState({ type: 'info', msg: 'Aguardando configuração da Ponte IP...' });
  
  const localVideo = useRef();
  const remoteVideo = useRef();
  const canvasRef = useRef(document.createElement("canvas"));
  const requestRef = useRef();
  const pc = useRef(new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  }));

  useEffect(() => {
    socket.on('connect', () => setStatus({ type: 'success', msg: 'Conectado ao servidor de sinalização!' }));
    socket.on('connect_error', () => setStatus({ type: 'error', msg: 'Erro de conexão com o servidor (CORS/Porta).' }));

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

    pc.current.ontrack = (e) => {
      if (remoteVideo.current) remoteVideo.current.srcObject = e.streams[0];
    };

    return () => {
      cancelAnimationFrame(requestRef.current);
      socket.off();
    };
  }, []);

  const startCall = () => {
    setStatus({ type: 'info', msg: 'Iniciando captura da Ponte IP...' });
    
    // Formata a URL da câmera (HTTP)
    const bridgeUrl = `http://${auth}@${bridgeIp}/video`;
    
    const img = new Image();
    // Removido crossOrigin para evitar erros em rede local HTTP
    img.src = bridgeUrl;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = 640; 
    canvas.height = 480;

    const renderLoop = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      requestRef.current = requestAnimationFrame(renderLoop);
    };

    img.onload = () => {
      renderLoop();
      // Captura o sinal (15 FPS é ideal para o J7 Prime não esquentar)
      const stream = canvas.captureStream(15);
      localVideo.current.srcObject = stream;
      
      stream.getTracks().forEach(track => pc.current.addTrack(track, stream));
      socket.emit('join-room', 'sala-1');
      setInCall(true);
      setStatus({ type: 'success', msg: 'Transmissão ativa!' });
    };

    img.onerror = () => {
      setStatus({ type: 'error', msg: 'Falha na imagem. Ative "Conteúdo Inseguro" no cadeado do navegador.' });
    };
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-6">
      <main className="container mx-auto max-w-4xl flex flex-col items-center">
        <h1 className="text-3xl font-black mb-8 text-white text-center">
          Digital <span className="text-blue-500">Connect</span> BRIDGE
        </h1>

        {!inCall && (
          <div className="bg-slate-900/80 p-6 rounded-2xl border border-white/10 mb-8 w-full max-w-md">
            <div className="space-y-4">
              <input 
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                placeholder="IP (Ex: 192.168.0.15:8081)"
                value={bridgeIp}
                onChange={(e) => setBridgeIp(e.target.value)}
              />
              <input 
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
                placeholder="Usuário:Senha (Ex: admin:1234)"
                value={auth}
                onChange={(e) => setAuth(e.target.value)}
              />
              <button onClick={startCall} className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold shadow-lg transition-all">
                CONECTAR AO GATEWAY
              </button>
            </div>
            <p className={`mt-4 text-[10px] text-center font-mono ${status.type === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>
              {status.msg}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          <div className="bg-black rounded-3xl border border-white/10 overflow-hidden aspect-video relative shadow-2xl">
            <video ref={localVideo} autoPlay playsInline muted className="w-full h-full object-contain" />
            <span className="absolute bottom-4 left-4 text-[9px] bg-blue-600 px-2 py-1 rounded font-bold">FONTE: J7 BRIDGE</span>
          </div>
          <div className="bg-black rounded-3xl border border-white/10 overflow-hidden aspect-video relative shadow-2xl">
            <video ref={remoteVideo} autoPlay playsInline className="w-full h-full object-contain" />
            <span className="absolute bottom-4 left-4 text-[9px] bg-emerald-600 px-2 py-1 rounded font-bold">MONITOR REMOTO</span>
          </div>
        </div>
      </main>
    </div>
  );
}