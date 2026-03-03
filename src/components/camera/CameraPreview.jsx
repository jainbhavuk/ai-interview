import { useEffect, useRef, useState } from "react";
import styles from "./CameraPreview.module.css";

export function CameraPreview({ onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function start() {
      try {
        const stream = await navigator?.mediaDevices?.getUserMedia?.({
          video: { facingMode: "user" },
          audio: false,
        });

        if (isCancelled || !stream) {
          stream?.getTracks?.().forEach((t) => t?.stop?.());
          return;
        }

        streamRef.current = stream;

        const el = videoRef.current;
        if (el) {
          el.srcObject = stream;
          await el.play?.();
        }

        if (!isCancelled) {
          setIsReady(true);
        }
      } catch {
        if (!isCancelled && typeof onClose === "function") onClose();
      }
    }

    start();

    return () => {
      isCancelled = true;
      streamRef.current?.getTracks?.().forEach((t) => t?.stop?.());
      streamRef.current = null;
    };
  }, [onClose]);

  function handleClose() {
    streamRef.current?.getTracks?.().forEach((t) => t?.stop?.());
    streamRef.current = null;
    if (typeof onClose === "function") onClose();
  }

  return (
    <div className={styles.wrap} aria-label="Camera preview">
      <button
        type="button"
        className={styles.close}
        onClick={handleClose}
        aria-label="Close camera preview"
      >
        ×
      </button>
      <video
        ref={videoRef}
        className={styles.video}
        playsInline
        muted
        autoPlay
      />
      {!isReady && <div className={styles.loading}>Starting camera...</div>}
    </div>
  );
}

