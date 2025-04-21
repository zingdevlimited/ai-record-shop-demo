import React, { useState, useEffect, useRef } from "react";

interface TypewriterTextProps {
  text: string;
  speed?: number; // Milliseconds per character
  interrupt?: boolean; // Signal to stop typing and show full text
}

const TypewriterText: React.FC<TypewriterTextProps> = ({
  text,
  speed = 50,
  interrupt = false, // Default to false
}) => {
  const [displayedText, setDisplayedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  // Use a ref to keep track of the timeout ID to clear it explicitly if needed
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  // Effect 1: Reset component state when the core 'text' prop changes
  useEffect(() => {
    console.log("Text Change" + interrupt);

    // Clear any pending timeout from the previous text
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
    // Reset display and index for the new text
    setDisplayedText("");
    setCurrentIndex(0);
  }, [text]); // Only depends on text

  // Effect 2: Handle typing animation and interruption logic
  useEffect(() => {
    console.log("Index, interrupt something change" + interrupt);

    // --- Interruption Check ---
    // If interrupt signal is received AND text is not fully displayed yet
    if (interrupt && currentIndex < text.length) {
      // Clear any potentially running timeout immediately
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
      return;
    }
    // --- End Interruption Check ---

    // --- Normal Typing Logic ---
    // Stop if text is empty or typing is already complete
    if (!text || currentIndex >= text.length) {
      // Ensure final state is the full text if it wasn't set by interrupt
      if (displayedText !== text && text) {
        setDisplayedText(text);
      }
      return;
    }

    // Set a timeout to add the next character
    timeoutIdRef.current = setTimeout(() => {
      setDisplayedText((prev) => prev + text[currentIndex]);
      setCurrentIndex((prev) => prev + 1);
      timeoutIdRef.current = null; // Clear ref after timeout runs
    }, speed);

    // Cleanup function for this effect
    return () => {
      // Clear timeout if effect re-runs or component unmounts
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }
    };
    // Dependencies: Re-run if index, text, speed, or interrupt signal changes
  }, [currentIndex, text, speed, interrupt, displayedText]); // Added interrupt, displayedText to dependencies

  return <span>{displayedText}</span>;
};

export default TypewriterText;
