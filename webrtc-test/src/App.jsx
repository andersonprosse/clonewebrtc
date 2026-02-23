import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

// Ajuste para o seu link do servidor de sinalização (Porta 3001)
const socket = io('https://reimagined-fishstick-4jrwj7g6w4q42q47p-3001.app.github.dev');

export default function App() {
  const [inCall, setInCall] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [status, setStatus] = useState({ type: 'info', msg: 'Aguardando detecção...' });
  
  const localVideo = useRef();
  const remoteVideo = useRef();
  const pc = useRef(new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  }));

  const detectCameras = async () => {
    try {
      setStatus({ type: 'info', msg: 'Acessando hardware...' });
      
      // Solicita apenas vídeo (audio: false é crucial para câmeras de inspeção)
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter(d => d.kind === 'videoinput');
      
      setDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDevice) {
        setSelectedDevice(videoInputs[0].deviceId);
      }

      // Libera a câmera imediatamente após listar
      stream.getTracks().forEach(track => track.stop());
      setStatus({ type: 'success', msg: 'Câmeras prontas.' });
    } catch (err) {
      console.error(err);
      if (err.name === 'NotReadableError') {
        setStatus({ type: 'error', msg: 'Câmera ocupada. Feche o preview do Chrome ou outros apps.' });
      } else {
        setStatus({ type: 'error', msg: `Erro: ${err.name}` });
      }
    }
  };

  useEffect(() => {
    detectCameras();

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
  }, []);

  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: selectedDevice } },
        audio: false
      });
      
      localVideo.current.srcObject = stream;
      stream.getTracks().forEach(track => pc.current.addTrack(track, stream));
      socket.emit('join-room', 'sala-1');
      setInCall(true);
      setStatus({ type: 'success', msg: 'Transmissão ativa.' });
    } catch (err) {
      setStatus({ type: 'error', msg: 'Falha ao iniciar. Verifique se a câmera foi desconectada.' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans">
      <main className="container mx-auto px-6 py-12 flex flex-col items-center">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-black text-white mb-2">Digital <span className="text-blue-500">Connect</span></h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.3em]">Industrial Inspection System</p>
          
          <div className="mt-8 bg-slate-900/50 p-6 rounded-2xl border border-white/5 backdrop-blur-sm">
            <p className="text-[10px] uppercase font-bold text-blue-400 mb-4 tracking-widest">Configuração de Hardware</p>
            <div className="flex flex-wrap justify-center gap-4">
              <select 
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="bg-slate-950 border border-white/10 rounded-lg px-4 py-2 text-sm outline-none focus:border-blue-500 min-w-[200px]"
              >
                {devices.length === 0 ? (
                  <option>Nenhuma câmera...</option>
                ) : (
                  devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || 'Câmera Externa'}</option>
                  ))
                )}
              </select>
              <button onClick={detectCameras} className="bg-white/5 hover:bg-white/10 p-2 rounded-lg border border-white/10 transition-all">🔄</button>
            </div>
            <p className={`mt-4 text-[10px] font-mono ${status.type === 'error' ? 'text-rose-400' : 'text-emerald-400'}`}>
              {status.msg}
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-5xl">
          <div className="bg-black rounded-3xl border border-white/10 overflow-hidden aspect-video relative">
            <video ref={localVideo} autoPlay playsInline muted className="w-full h-full object-cover" />
            <span className="absolute top-4 left-4 text-[9px] bg-blue-600 px-2 py-1 rounded font-bold">LOCAL / INSPEÇÃO</span>
          </div>
          <div className="bg-black rounded-3xl border border-white/10 overflow-hidden aspect-video relative">
            <video ref={remoteVideo} autoPlay playsInline className="w-full h-full object-cover" />
            <span className="absolute top-4 left-4 text-[9px] bg-emerald-600 px-2 py-1 rounded font-bold">REMOTO / MONITOR</span>
          </div>
        </div>

        <div className="mt-12">
          {!inCall ? (
            <button 
              onClick={startCall}
              disabled={devices.length === 0}
              className="px-12 py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-lg"
            >
              INICIAR TRANSMISSÃO
            </button>
          ) : (
            <button onClick={() => window.location.reload()} className="px-12 py-4 bg-rose-600/20 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-600/30 rounded-xl font-bold transition-all">
              DESCONECTAR
            </button>
          )}
        </div>
      </main>
    </div>
  );
}