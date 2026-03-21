import { useEffect, useRef, useState } from "react";

export function useVoice(onTranscript: (text: string) => void, disabled?: boolean) {
  const cb = useRef(onTranscript);
  cb.current = onTranscript;

  const disabledRef = useRef(false);
  disabledRef.current = disabled ?? false;

  const recognition = useRef<{
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    onresult: ((ev: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
    onerror: (() => void) | null;
  } | null>(null);

  const [listening, setListening] = useState(false);

  useEffect(() => {
    const SR =
      (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown })
        .webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR() as NonNullable<typeof recognition.current>;
    recognition.current = r;
    r.continuous = false;
    r.interimResults = false;
    r.lang = "en-US";
    r.onresult = (e) => {
      if (disabledRef.current) {
        setListening(false);
        return;
      }
      const text = e.results[0][0].transcript;
      cb.current(text);
      setListening(false);
    };
    r.onerror = () => setListening(false);
    return () => {
      recognition.current = null;
    };
  }, []);

  const startListening = () => {
    if (disabledRef.current) return;
    try {
      recognition.current?.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const stopListening = () => {
    try {
      recognition.current?.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  };

  return { listening, startListening, stopListening };
}
