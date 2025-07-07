"use client";

import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

interface Props {
  wsUrl: string;
  className?: string;
}

export default function Terminal({ wsUrl, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTerm>();

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      fontFamily: "Menlo, monospace",
      fontSize: 14,
      cursorBlink: true,
      theme: { background: "#1e1e1e" },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    // initial fit deferred until element has size via ResizeObserver
    termRef.current = term;

    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => term.focus();
    ws.onmessage = (ev) => {
      const data = ev.data instanceof ArrayBuffer ? new Uint8Array(ev.data) : ev.data;
      term.write(data);
    };
    ws.onclose = () => term.write("\r\n\x1b[31m[ disconnected ]\x1b[0m\r\n");

    term.onData((d: string) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(d);
    });

    const resize = () => fitAddon.fit();
    window.addEventListener("resize", resize);
    // ResizeObserver to react to parent size changes
    const ro = new ResizeObserver((entries) => {
      if (entries[0].contentRect.width > 0 && entries[0].contentRect.height > 0) {
        fitAddon.fit();
      }
    });
    ro.observe(containerRef.current);

    return () => {
      window.removeEventListener("resize", resize);
      ro.disconnect();
      ws.close();
      term.dispose();
    };
  }, [wsUrl]);

  return <div ref={containerRef} className={"h-96 w-full bg-black " + (className || "")} />;
}
