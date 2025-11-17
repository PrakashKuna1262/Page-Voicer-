import React, { useState, useEffect, useRef } from "react";
import "./Translator.css";

// Google Translate via CORS proxy
const GOOGLE_TRANSLATE_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest=',
  '', // Direct (may work sometimes)
];

const LANGUAGE_OPTIONS = [
  { code: "hi", name: "Hindi" },
  { code: "te", name: "Telugu" },
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "ja", name: "Japanese" },
  { code: "zh", name: "Chinese" },
  { code: "ar", name: "Arabic" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
];

export default function Translator({
  text,
  targetLang,
  onTargetLangChange,
  onTranslated,
  disabled,
}) {
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const [error, setError] = useState("");
  const [translationProgress, setTranslationProgress] = useState("");
  const debounceTimerRef = useRef(null);
  const lastTranslatedTextRef = useRef("");
  const lastTranslatedLangRef = useRef("");
  const initialLangSetRef = useRef(false);

  // Split text into chunks for parallel processing (larger chunks, faster)
  const splitTextIntoChunks = (text, maxLength = 5000) => {
    if (text.length <= maxLength) {
      return [text];
    }

    const chunks = [];
    // Try to split by sentences first for better translation quality
    const sentences = text.match(/[^.!?]+[.!?]+/g) || text.match(/[^\n]+\n?/g) || [text];
    let currentChunk = "";

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= maxLength) {
        currentChunk += sentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        // If single sentence is too long, split by words
        if (sentence.length > maxLength) {
          const words = sentence.split(/\s+/);
          let wordChunk = "";
          for (const word of words) {
            if ((wordChunk + word).length <= maxLength) {
              wordChunk += word + " ";
            } else {
              if (wordChunk) {
                chunks.push(wordChunk.trim());
              }
              wordChunk = word + " ";
            }
          }
          currentChunk = wordChunk;
        } else {
          currentChunk = sentence;
        }
      }
    }
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    return chunks;
  };


  // Simple language detection - check for common language patterns
  const detectSourceLanguage = (text) => {
    // Check for common non-English characters
    if (/[\u0900-\u097F]/.test(text)) return "hi"; // Hindi
    if (/[\u0C00-\u0C7F]/.test(text)) return "te"; // Telugu
    if (/[\u4E00-\u9FFF]/.test(text)) return "zh"; // Chinese
    if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "ja"; // Japanese
    if (/[\u0600-\u06FF]/.test(text)) return "ar"; // Arabic
    if (/[\u0400-\u04FF]/.test(text)) return "ru"; // Russian
    
    // Check for European languages
    if (/[àáâãäåæçèéêëìíîïñòóôõöøùúûüýÿ]/.test(text.toLowerCase())) {
      if (/[ñ]/.test(text.toLowerCase())) return "es"; // Spanish has ñ
      if (/[àâäèéêëïîôùûüÿ]/.test(text.toLowerCase())) return "fr"; // French
      if (/[äöüß]/.test(text.toLowerCase())) return "de"; // German
      return "es"; // Default to Spanish for other Romance languages
    }
    
    // Default to English if no specific pattern found
    return "en";
  };

  // Google Translate (only service - optimized for speed)
  const translateWithGoogle = async (textToTranslate, target) => {
    // Map language codes to Google Translate format
    const googleLangMap = {
      'hi': 'hi', 'te': 'te', 'en': 'en', 'es': 'es', 'fr': 'fr',
      'de': 'de', 'ja': 'ja', 'zh': 'zh-CN', 'ar': 'ar', 'pt': 'pt', 'ru': 'ru'
    };
    const googleTarget = googleLangMap[target] || target;
    
    // Try auto-detection or use detected source
    const detectedSourceLang = detectSourceLanguage(textToTranslate);
    const googleSource = googleLangMap[detectedSourceLang] || 'auto';
    
    // Use larger chunks (5000 chars) for faster processing - Google can handle it
    const chunks = splitTextIntoChunks(textToTranslate, 5000);
    
    // Process chunks in parallel for faster translation
    const translateChunk = async (chunk, chunkIndex) => {
      for (const proxy of GOOGLE_TRANSLATE_PROXIES) {
        try {
          // Google Translate API endpoint (via proxy)
          const googleUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${googleSource}&tl=${googleTarget}&dt=t&q=${encodeURIComponent(chunk)}`;
          const proxiedUrl = proxy ? proxy + encodeURIComponent(googleUrl) : googleUrl;
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);
          
          try {
            const response = await fetch(proxiedUrl, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                ...(proxy ? {} : { 'Referer': 'https://translate.google.com/' }),
              },
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
              continue; // Try next proxy
            }
            
            const data = await response.json();
            
            // Google Translate returns nested array: [[["translated text", "original", ...], ...], ...]
            if (data && Array.isArray(data) && data[0] && Array.isArray(data[0])) {
              const translatedText = data[0]
                .map(item => item && item[0] ? item[0] : '')
                .filter(text => text && text.trim())
                .join('');
              
              if (translatedText && translatedText.trim() !== "" && translatedText.trim() !== chunk.trim()) {
                return translatedText;
              }
            }
          } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
              continue; // Try next proxy
            }
            continue; // Try next proxy
          }
        } catch (err) {
          continue; // Try next proxy
        }
      }
      throw new Error(`Failed to translate chunk ${chunkIndex + 1}`);
    };

    // For single chunk, translate directly
    if (chunks.length === 1) {
      setTranslationProgress("Translating...");
      const result = await translateChunk(textToTranslate, 0);
      setTranslationProgress("");
      return result;
    }

    // For multiple chunks, process in parallel batches for speed
    setTranslationProgress(`Translating ${chunks.length} chunks in parallel...`);
    const translatedChunks = [];
    
    // Process chunks in parallel (batch size 3 to avoid overwhelming)
    const batchSize = 3;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchPromises = batch.map((chunk, batchIndex) => {
        const chunkIndex = i + batchIndex;
        setTranslationProgress(`Translating chunk ${chunkIndex + 1} of ${chunks.length}...`);
        return translateChunk(chunk, chunkIndex);
      });
      
      try {
        const batchResults = await Promise.all(batchPromises);
        translatedChunks.push(...batchResults);
      } catch (err) {
        // If batch fails, try chunks sequentially as fallback
        for (const chunk of batch) {
          const chunkIndex = i + batch.indexOf(chunk);
          setTranslationProgress(`Translating chunk ${chunkIndex + 1} of ${chunks.length}...`);
          try {
            const result = await translateChunk(chunk, chunkIndex);
            translatedChunks.push(result);
          } catch (chunkErr) {
            throw new Error(`Failed to translate chunk ${chunkIndex + 1}: ${chunkErr.message}`);
          }
        }
      }
    }
    
    setTranslationProgress("");
    return translatedChunks.join(" ");
  };


  const translateText = async (retryCount = 0) => {
    if (!text || !text.trim() || disabled) {
      console.log("Cannot translate:", { text: !!text, disabled });
      return;
    }

    // Check if source and target languages are the same
    const detectedSourceLang = detectSourceLanguage(text);
    if (detectedSourceLang === targetLang) {
      console.log("ℹ️ Source and target languages are the same, returning original text");
      setTranslated(text);
      onTranslated(text);
      setError("");
      setTranslating(false);
      lastTranslatedTextRef.current = text;
      lastTranslatedLangRef.current = targetLang;
      return;
    }

    setTranslating(true);
    if (retryCount === 0) {
      setTranslated("");
      setError("");
    }
    setTranslationProgress("");

    try {
      let translatedText = "";

      // Use Google Translate only (faster and more reliable)
      console.log("🌐 Translating with Google Translate...");
      translatedText = await translateWithGoogle(text, targetLang);
      console.log("✅ Translation succeeded");

      if (!translatedText || translatedText.trim() === "") {
        throw new Error("Translation returned empty result");
      }

      setTranslated(translatedText);
      onTranslated(translatedText);
      setError(""); // Clear any previous errors on success
      
      // Update refs on successful translation
      lastTranslatedTextRef.current = text;
      lastTranslatedLangRef.current = targetLang;
    } catch (error) {
      console.error("❌ Translation Error:", error);
      const errorMsg = error.message || "Translation failed";
      setError(errorMsg);
      setTranslated("");
      onTranslated("");
    } finally {
      setTranslating(false);
      setTranslationProgress("");
    }
  };

  // Set initial language based on detected source language when text first appears
  useEffect(() => {
    if (text && text.trim() && !initialLangSetRef.current) {
      const detectedLang = detectSourceLanguage(text);
      console.log("🌐 Detected source language:", detectedLang);
      // Set the detected language as the default target language
      onTargetLangChange(detectedLang);
      initialLangSetRef.current = true;
    }
    // Reset when text is cleared
    if (!text || !text.trim()) {
      initialLangSetRef.current = false;
    }
  }, [text, onTargetLangChange]);

  // Auto-translate when text or target language changes
  useEffect(() => {
    // Clear any pending debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Only auto-translate if:
    // 1. We have text and it's not disabled
    // 2. Either the text changed or the target language changed
    // 3. We're not currently translating
    if (!text || !text.trim() || disabled || translating) {
      return;
    }

    const textChanged = text !== lastTranslatedTextRef.current;
    const langChanged = targetLang !== lastTranslatedLangRef.current;

    // If nothing changed, don't retranslate
    if (!textChanged && !langChanged) {
      return;
    }

    // Debounce the translation to avoid too many API calls
    debounceTimerRef.current = setTimeout(() => {
      console.log("🔄 Auto-translating due to change:", { textChanged, langChanged });
      translateText();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 300); // Reduced to 300ms for faster response

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, targetLang, disabled]);

  // Update refs when translation completes
  useEffect(() => {
    if (translated && !error && !translating) {
      lastTranslatedTextRef.current = text;
      lastTranslatedLangRef.current = targetLang;
    }
  }, [translated, error, translating, text, targetLang]);

  const copyToClipboard = (textToCopy, event) => {
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        // Show a brief notification
        if (event && event.target) {
          const btn = event.target;
          const originalText = btn.textContent;
          btn.textContent = "✓ Copied!";
          setTimeout(() => {
            btn.textContent = originalText;
          }, 2000);
        } else {
          // Fallback if no event
          console.log("Text copied to clipboard");
        }
      }).catch((err) => {
        console.error("Failed to copy:", err);
        alert("Failed to copy text");
      });
    }
  };

  return (
    <div className="translator-card">
      <div className="card-header">
        <h3>🌐 Translate Text</h3>
      </div>
      <div className="card-content">
        {text && (
          <div className="original-text-box">
            <div className="text-box-header">
              <button
                className={`toggle-button ${showOriginal ? "active" : ""}`}
                onClick={() => setShowOriginal(!showOriginal)}
              >
                📝 Original
              </button>
              <button
                className="copy-button"
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(text, e);
                }}
                title="Copy original text"
              >
                📋 Copy
              </button>
            </div>
            {showOriginal && (
              <div className="text-content original-content">{text}</div>
            )}
          </div>
        )}

        <div className="language-selector">
          <label htmlFor="target-lang">Translate to:</label>
          <select
            id="target-lang"
            value={targetLang}
            onChange={(e) => {
              onTargetLangChange(e.target.value);
              // Translation will happen automatically via useEffect
            }}
            className="language-select"
          >
            {LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
        
        {translationProgress && (
          <div className="progress-info">
            <p className="progress-text">{translationProgress}</p>
          </div>
        )}

        {error && (
          <div className="error-box">
            <p className="error-text">⚠️ {error}</p>
            <button
              className="retry-button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log("🔄 Retry button clicked");
                setError(""); // Clear error before retry
                translateText(0); // Reset retry count
              }}
              disabled={translating || !text || disabled}
            >
              {translating ? "Retrying..." : "🔄 Retry"}
            </button>
          </div>
        )}

        {translated && !error && (
          <div className="result-box">
            <div className="result-header">
              <h4>Translated Text:</h4>
              <button
                className="copy-button"
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(translated, e);
                }}
                title="Copy translated text"
              >
                📋 Copy
              </button>
            </div>
            <div className="text-content">{translated}</div>
          </div>
        )}
      </div>
    </div>
  );
}
