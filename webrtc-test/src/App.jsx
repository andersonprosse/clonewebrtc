import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

// SUBSTITUA PELO SEU LINK DA PORTA 3001 (DEVE SER HTTPS)
const socket = io('https://reimagined-fishstick-4jrwj7g6w4q42q47p-3001.app.github.dev');

export default function App() {
  const [inCall, setInCall] = useState(false);
  const localVideo = useRef();
  const remoteVideo = useRef();
  const pc = useRef(new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  }));

  useEffect(() => {
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
      remoteVideo.current.srcObject = e.streams[0];
    };
  }, []);

  const startCall = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.current.srcObject = stream;
    stream.getTracks().forEach(track => pc.current.addTrack(track, stream));
    socket.emit('join-room', 'sala-1');
    setInCall(true);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans selection:bg-blue-500/30">
      {/* Background Decorativo */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[120px] rounded-full"></div>
      </div>

      <main className="relative z-10 container mx-auto px-6 py-12 flex flex-col items-center">
        {/* Header Profissional */}
        <header className="mb-12 text-center">
          <div className="inline-block px-4 py-1.5 mb-4 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest">
            Sistema de Alta Performance
          </div>
          <h1 className="text-5xl font-black tracking-tight text-white mb-4">
            Digital <span className="text-blue-500">Connect</span>
          </h1>
          <p className="text-slate-400 max-w-md mx-auto">
            Engenharia de conexão em tempo real com protocolo WebRTC avançado.
          </p>
        </header>

        {/* Grid de Vídeos Lado a Lado */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-6xl h-full">
          {/* Vídeo Local */}
          <div className="relative group rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden shadow-2xl transition-all duration-500 hover:border-blue-500/50">
            <video ref={localVideo} autoPlay playsInline muted className="w-full h-full aspect-video object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
            <div className="absolute bottom-6 left-6 flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-semibold tracking-wide">Você (Local)</span>
            </div>
            {!inCall && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
                <p className="text-slate-400 text-sm">Câmera desligada</p>
              </div>
            )}
          </div>

          {/* Vídeo Remoto */}
          <div className="relative group rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden shadow-2xl transition-all duration-500 hover:border-emerald-500/50">
            <video ref={remoteVideo} autoPlay playsInline className="w-full h-full aspect-video object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
            <div className="absolute bottom-6 left-6 flex items-center gap-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-semibold tracking-wide">Remoto (Conectado)</span>
            </div>
          </div>
        </div>

        {/* Controles Inferiores */}
        <div className="mt-16 flex items-center gap-6">
          {!inCall ? (
            <button 
              onClick={startCall}
              className="group relative px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-lg transition-all duration-300 shadow-[0_0_40px_rgba(37,99,235,0.3)] active:scale-95"
            >
              Iniciar Reunião
              <div className="absolute inset-0 rounded-2xl border-2 border-white/20 scale-105 opacity-0 group-hover:opacity-100 transition-all"></div>
            </button>
          ) : (
            <button 
              onClick={() => window.location.reload()}
              className="px-12 py-4 bg-rose-600/10 hover:bg-rose-600 border border-rose-600/20 text-rose-500 hover:text-white rounded-2xl font-bold text-lg transition-all duration-300 active:scale-95"
            >
              Encerrar Chamada
            </button>
          )}
        </div>

        {/* Footer Técnico */}
        <footer className="mt-20 text-slate-500 text-[10px] uppercase tracking-[0.2em]">
          Powered by WebRTC Engine • P2P Optimized Connection
        </footer>
      </main>
    </div>
  );
}