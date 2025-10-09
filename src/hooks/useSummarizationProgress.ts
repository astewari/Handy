import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

export const useSummarizationProgress = () => {
  const [progressText, setProgressText] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      unlisten = await listen<string>("summarization-progress", (event) => {
        setProgressText(event.payload);
        setIsProcessing(true);
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const clearProgress = () => {
    setProgressText("");
    setIsProcessing(false);
  };

  return { progressText, isProcessing, clearProgress };
};
