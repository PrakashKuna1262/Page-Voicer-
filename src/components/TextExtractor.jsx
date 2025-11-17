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
      // Use comprehensive multi-language OCR to support any language
      // Tesseract supports combining multiple languages with "+"
      // This list includes major languages from around the world
      const comprehensiveLanguages = [
        // Indian languages
        "eng+tel+hin+tam+kan+mal+guj+pan+ben+ori+asm+mar+urd",
        // Asian languages
        "eng+chi_sim+chi_tra+jpn+kor+tha+vie",
        // European languages
        "eng+spa+fra+deu+ita+por+rus+pol+nld+ron+ces+hun+bul+hrv+slv",
        // Middle Eastern languages
        "eng+ara+heb+fas+tur",
        // Try individual language groups for better accuracy
        "tel", "hin", "tam", "kan", "mal", "guj", "pan", "ben",
        "chi_sim", "chi_tra", "jpn", "kor",
        "spa", "fra", "deu", "ita", "por", "rus",
        "ara", "heb", "fas", "tur",
        // Final fallback to English
        "eng"
      ];
      
      let bestResult = null;
      let bestTextLength = 0;
      let lastError = null;
      
      // Try comprehensive multi-language first (most likely to work)
      try {
        console.log(`🔍 Trying comprehensive multi-language OCR...`);
        const result = await Tesseract.recognize(image, comprehensiveLanguages[0], {
          logger: (m) => {
            if (m.status === "recognizing text") {
              const progress = Math.round(m.progress * 100);
              setProgress(progress);
              setStatus("Extracting text...");
            }
          },
        });
        
        const text = result.data.text.trim();
        const textLength = text.length;
        
        if (textLength > 0) {
          console.log(`✅ Successfully extracted with comprehensive languages, text length: ${textLength}`);
          setExtractedText(text);
          onTextExtracted(text);
          setStatus("Text extracted successfully!");
          setExtracting(false);
          setProgress(0);
          return;
        }
      } catch (err) {
        console.warn(`⚠️ Comprehensive OCR failed, trying individual languages:`, err.message);
        lastError = err;
      }
      
      // If comprehensive failed, try individual language groups
      for (let i = 1; i < comprehensiveLanguages.length; i++) {
        const lang = comprehensiveLanguages[i];
        try {
          console.log(`🔍 Trying OCR with language: ${lang}`);
          const result = await Tesseract.recognize(image, lang, {
            logger: (m) => {
              if (m.status === "recognizing text") {
                const progress = Math.round(m.progress * 100);
                setProgress(progress);
                setStatus("Extracting text...");
              }
            },
          });
          
          const text = result.data.text.trim();
          const textLength = text.length;
          
          // Track the best result (longest text extracted)
          if (textLength > bestTextLength) {
            bestResult = result;
            bestTextLength = textLength;
            console.log(`✅ Better result with ${lang}, text length: ${textLength}`);
          }
          
          // If we got substantial text (more than 10 characters), use this result immediately
          if (textLength > 10) {
            console.log(`✅ Successfully extracted with ${lang}, using this result`);
            setExtractedText(text);
            onTextExtracted(text);
            setStatus("Text extracted successfully!");
            setExtracting(false);
            setProgress(0);
            return;
          }
        } catch (err) {
          console.warn(`⚠️ Failed with ${lang}:`, err.message);
          // Continue to next language
          continue;
        }
      }
      
      // Use the best result we found (even if it's short)
      if (bestResult && bestResult.data.text.trim()) {
        const text = bestResult.data.text.trim();
        console.log(`✅ Using best result with text length: ${text.length}`);
        setExtractedText(text);
        onTextExtracted(text);
        setStatus("Text extracted successfully!");
      } else {
        throw lastError || new Error("Failed to extract text. Please ensure the image is clear and contains readable text.");
      }
    } catch (error) {
      console.error("OCR Error:", error);
      setStatus("Error extracting text: " + (error.message || "Please ensure the image is clear and contains readable text"));
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
