import React, { useState, useEffect } from "react";
import Tesseract from "tesseract.js";
import "./TextExtractor.css";

export default function TextExtractor({ image, onTextExtracted, disabled }) {
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [extractedText, setExtractedText] = useState("");

  useEffect(() => {
    if (image && !disabled) {
      extractText();
    }
  }, [image]);

  const extractText = async () => {
    if (!image || disabled) return;

    setExtracting(true);
    setProgress(0);
    setStatus("Extracting text...");
    setExtractedText("");

    try {
      const result = await Tesseract.recognize(image, "eng", {
        logger: (m) => {
          // Only update progress, keep status message as "Extracting text..."
          if (m.status === "recognizing text") {
            const progress = Math.round(m.progress * 100);
            setProgress(progress);
            // Keep status as "Extracting text..." instead of showing all intermediate messages
            setStatus("Extracting text...");
          }
          // Don't update status for other messages like "api connecting", etc.
        },
      });

      const text = result.data.text.trim();
      setExtractedText(text);
      onTextExtracted(text);
      setStatus("Text extracted successfully!");
    } catch (error) {
      console.error("OCR Error:", error);
      setStatus("Error extracting text: " + error.message);
      setExtractedText("");
      onTextExtracted("");
    } finally {
      setExtracting(false);
      setProgress(0);
    }
  };


  return (
    <div className="extractor-card">
      <div className="card-header">
        <h3>🔍 Extract Text</h3>
      </div>
      <div className="card-content">
        {extracting ? (
          <div className="progress-section">
            <div className="progress-bar-container">
              <div
                className="progress-bar"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="status-text">{status}</p>
          </div>
        ) : (
          <button
            className="action-button primary"
            onClick={extractText}
            disabled={disabled || !image}
          >
            Extract Text from Page
          </button>
        )}
      </div>
    </div>
  );
}
