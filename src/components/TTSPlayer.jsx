import React, { useState, useEffect, useRef } from "react";
import "./TTSPlayer.css";

const LANGUAGE_CODES = {
  hi: "hi-IN",
  te: "te-IN",
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  ja: "ja-JP",
  zh: "zh-CN",
  ar: "ar-SA",
  pt: "pt-BR",
  ru: "ru-RU",
};

export default function TTSPlayer({ text, lang, disabled }) {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [starting, setStarting] = useState(false);
  const [available, setAvailable] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [voiceType, setVoiceType] = useState("default"); // 'default', 'male', 'female'
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [currentUtterance, setCurrentUtterance] = useState(null);
  const [pausedText, setPausedText] = useState("");
  const [pausedPosition, setPausedPosition] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const prevSpeedRef = useRef(1.0);
  const audioContextRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const speechStartTimeRef = useRef(null);
  const pauseTimeRef = useRef(null);
  const totalElapsedTimeRef = useRef(0);
  const lastUtteranceRef = useRef(null);
  const chunkedSpeechRef = useRef(null); // Store chunked speech state
  const currentChunkIndexRef = useRef(0);
  const textChunksRef = useRef([]);

  useEffect(() => {
    // Check if speech synthesis is available
    setAvailable("speechSynthesis" in window);
    
    if ("speechSynthesis" in window) {
      // Load available voices
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
        
        // Try to find a voice matching the language
        const langCode = LANGUAGE_CODES[lang] || "en-US";
        const langPrefix = langCode.split("-")[0];
        const matchingVoice = availableVoices.find(
          (v) => v.lang.startsWith(langPrefix)
        );
        if (matchingVoice) {
          setSelectedVoice(matchingVoice);
        }
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [lang]);

  const getVoiceForType = () => {
    if (!selectedVoice && voices.length > 0) {
      const langCode = LANGUAGE_CODES[lang] || "en-US";
      const langPrefix = langCode.split("-")[0];
      return voices.find((v) => v.lang.startsWith(langPrefix)) || voices[0];
    }
    
    if (voiceType === "male" || voiceType === "female") {
      const langCode = LANGUAGE_CODES[lang] || "en-US";
      const langPrefix = langCode.split("-")[0];
      const matchingVoices = voices.filter((v) => 
        v.lang.startsWith(langPrefix)
      );
      
      if (matchingVoices.length > 0) {
        // Filter by gender (this is a heuristic - browsers don't always provide gender)
        if (voiceType === "male") {
          const maleVoice = matchingVoices.find((v) => 
            v.name.toLowerCase().includes("male") || 
            v.name.toLowerCase().includes("david") ||
            v.name.toLowerCase().includes("mark")
          );
          return maleVoice || matchingVoices[0];
        } else {
          const femaleVoice = matchingVoices.find((v) => 
            v.name.toLowerCase().includes("female") || 
            v.name.toLowerCase().includes("zira") ||
            v.name.toLowerCase().includes("samantha") ||
            v.name.toLowerCase().includes("susan")
          );
          return femaleVoice || matchingVoices[0];
        }
      }
    }
    
    return selectedVoice || voices[0];
  };

  const speak = () => {
    console.log("🔊 speak() called", { 
      text: !!text, 
      textLength: text?.length, 
      disabled, 
      available, 
      speaking, 
      paused 
    });
    
    if (!text || !text.trim()) {
      console.warn("⚠️ No text to speak");
      alert("No text to speak. Please extract text first.");
      return;
    }
    
    if (disabled) {
      console.warn("⚠️ Speech is disabled");
      return;
    }
    
    if (!available) {
      console.warn("⚠️ Speech synthesis not available");
      alert("Speech synthesis is not available in your browser.");
      return;
    }

    // If paused, resume from where we left off
    if (paused) {
      console.log("▶ Resuming speech");
      resumeSpeech();
      return;
    }

    // If already speaking, pause it
    if (speaking) {
      console.log("⏸ Pausing speech");
      pauseSpeech();
      return;
    }

    // Start new speech (this will cancel any ongoing speech internally)
    console.log("🎤 Starting new speech with text:", text.substring(0, 50));
    setStarting(true);
    startSpeech(text);
  };

  const startSpeech = (textToSpeak) => {
    try {
      // Cancel any ongoing speech first (immediately, no delay)
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
      
      // Start immediately for faster response (especially for large content)
      // Small delay only if cancellation was needed
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        setTimeout(() => {
          actuallyStartSpeech(textToSpeak);
        }, 50); // Reduced from 100ms to 50ms
      } else {
        actuallyStartSpeech(textToSpeak);
      }
    } catch (error) {
      console.error("Error in startSpeech:", error);
      setStarting(false);
      alert("Failed to start speech: " + error.message);
      setSpeaking(false);
      setPaused(false);
    }
  };

  const actuallyStartSpeech = (textToSpeak) => {
    try {
      // Ensure voices are loaded
      if (voices.length === 0) {
        const availableVoices = window.speechSynthesis.getVoices();
        if (availableVoices.length > 0) {
          setVoices(availableVoices);
          // Wait a bit and try again
          setTimeout(() => {
            actuallyStartSpeech(textToSpeak);
          }, 100);
          return;
        }
      }

      // For long text, split into chunks intelligently (larger chunks = faster)
      // Use larger chunks (500 chars) for better performance with large content
      const maxChunkLength = 500;
      let textChunks = [];
      
      if (textToSpeak.length <= maxChunkLength) {
        textChunks = [textToSpeak];
      } else {
        // Smart chunking: split by sentences first, then by words if needed
        const sentences = textToSpeak.match(/[^.!?]+[.!?]+/g) || textToSpeak.match(/[^\n]+\n?/g) || [textToSpeak];
        let currentChunk = '';
        
        for (const sentence of sentences) {
          if ((currentChunk + sentence).length <= maxChunkLength) {
            currentChunk += sentence;
          } else {
            if (currentChunk) {
              textChunks.push(currentChunk.trim());
            }
            // If sentence is too long, split by words
            if (sentence.length > maxChunkLength) {
              const words = sentence.split(/\s+/);
              let wordChunk = '';
              for (const word of words) {
                if ((wordChunk + word + ' ').length <= maxChunkLength) {
                  wordChunk += word + ' ';
                } else {
                  if (wordChunk) {
                    textChunks.push(wordChunk.trim());
                  }
                  wordChunk = word + ' ';
                }
              }
              currentChunk = wordChunk;
            } else {
              currentChunk = sentence;
            }
          }
        }
        if (currentChunk) {
          textChunks.push(currentChunk.trim());
        }
      }

      // Set paused text before speaking
      setPausedText(textToSpeak);
      setPausedPosition(0);
      
      if (textChunks.length === 1) {
        // Single chunk - simple speech
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        const langCode = LANGUAGE_CODES[lang] || "en-US";
        utterance.lang = langCode;
        utterance.rate = speed;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        const voice = getVoiceForType();
        if (voice) {
          utterance.voice = voice;
        }

        utterance.onstart = () => {
          console.log("✅ Speech started successfully");
          setStarting(false);
          setSpeaking(true);
          setPaused(false);
          setCurrentUtterance(utterance);
          speechStartTimeRef.current = Date.now();
          totalElapsedTimeRef.current = 0;
        };

        utterance.onend = () => {
          console.log("✅ Speech ended normally");
          setSpeaking(false);
          setPaused(false);
          setCurrentUtterance(null);
          // Update elapsed time before ending
          if (speechStartTimeRef.current) {
            const elapsed = Date.now() - speechStartTimeRef.current;
            totalElapsedTimeRef.current += elapsed;
            speechStartTimeRef.current = null;
          }
          if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
            setPausedText("");
            setPausedPosition(0);
            totalElapsedTimeRef.current = 0;
          }
        };

          utterance.onerror = (error) => {
            console.error("❌ Speech Synthesis Error:", error.error, error);
            setStarting(false);
            if (error.error !== 'interrupted' && error.error !== 'canceled' && error.error !== 'not-allowed') {
              alert(`Speech error: ${error.error || 'Unknown error'}`);
            }
            if (error.error !== 'interrupted' && error.error !== 'canceled') {
              setSpeaking(false);
              setPaused(false);
              setCurrentUtterance(null);
              setPausedText("");
              setPausedPosition(0);
            }
          };

        // Cancel any existing speech first
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
        }
        
        // Start immediately without delay for faster response
        console.log("🎤 Attempting to speak:", textToSpeak.substring(0, 50));
        window.speechSynthesis.speak(utterance);
        
        // Retry if it doesn't start (for browser compatibility)
        setTimeout(() => {
          if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending && !speaking) {
            console.log("🔄 Retrying speech...");
            window.speechSynthesis.speak(utterance);
          }
        }, 100);
      } else {
        // Multiple chunks - speak sequentially for long text (optimized for speed)
        currentChunkIndexRef.current = 0;
        textChunksRef.current = textChunks;
        chunkedSpeechRef.current = true;
        
        // Pre-create all utterances for faster processing
        const utterances = textChunks.map((chunk, index) => {
          const trimmedChunk = chunk.trim();
          if (!trimmedChunk) return null;
          
          const utterance = new SpeechSynthesisUtterance(trimmedChunk);
          const langCode = LANGUAGE_CODES[lang] || "en-US";
          utterance.lang = langCode;
          utterance.rate = speed;
          utterance.pitch = 1.0;
          utterance.volume = 1.0;

          const voice = getVoiceForType();
          if (voice) {
            utterance.voice = voice;
          }

          // Set up event handlers
          if (index === 0) {
            utterance.onstart = () => {
              console.log("✅ Speech started successfully (chunked, " + textChunks.length + " chunks)");
              setStarting(false);
              setSpeaking(true);
              setPaused(false);
              setCurrentUtterance(utterance);
              speechStartTimeRef.current = Date.now();
              totalElapsedTimeRef.current = 0;
            };
          }

          utterance.onend = () => {
            // Update elapsed time for this chunk
            if (speechStartTimeRef.current) {
              const elapsed = Date.now() - speechStartTimeRef.current;
              totalElapsedTimeRef.current += elapsed;
              speechStartTimeRef.current = Date.now();
            }
            
            currentChunkIndexRef.current++;
            const nextIndex = currentChunkIndexRef.current;
            
            if (nextIndex < utterances.length && utterances[nextIndex]) {
              // Speak next chunk immediately (no delay for speed)
              window.speechSynthesis.speak(utterances[nextIndex]);
            } else {
              // All chunks spoken
              console.log("✅ Speech ended normally (all chunks)");
              setSpeaking(false);
              setPaused(false);
              setCurrentUtterance(null);
              chunkedSpeechRef.current = false;
              speechStartTimeRef.current = null;
              totalElapsedTimeRef.current = 0;
              if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
                setPausedText("");
                setPausedPosition(0);
                currentChunkIndexRef.current = 0;
                textChunksRef.current = [];
              }
            }
          };

          utterance.onerror = (error) => {
            console.error("❌ Speech Synthesis Error:", error.error, error);
            if (error.error !== 'interrupted' && error.error !== 'canceled' && error.error !== 'not-allowed') {
              // Only show alert for first chunk to avoid spam
              if (index === 0) {
                setStarting(false);
                alert(`Speech error: ${error.error || 'Unknown error'}`);
              }
            }
            // Continue with next chunk on error (unless interrupted)
            if (error.error === 'interrupted' || error.error === 'canceled') {
              if (index === 0) {
                setStarting(false);
              }
              return;
            }
            currentChunkIndexRef.current++;
            const nextIndex = currentChunkIndexRef.current;
            if (nextIndex < utterances.length && utterances[nextIndex]) {
              window.speechSynthesis.speak(utterances[nextIndex]);
            } else if (index === 0) {
              // If no more chunks and this was the first, clear starting state
              setStarting(false);
            }
          };

          return utterance;
        }).filter(utt => utt !== null);

        // Cancel any existing speech first
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
        }
        
        // Start speaking immediately - no delay for faster response
        console.log("🎤 Starting chunked speech:", utterances.length, "chunks");
        if (utterances.length > 0) {
          window.speechSynthesis.speak(utterances[0]);
          
          // Retry if it doesn't start (for browser compatibility)
          setTimeout(() => {
            if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending && !speaking) {
              console.log("🔄 Retrying chunked speech...");
              window.speechSynthesis.speak(utterances[0]);
            }
          }, 100);
        }
      }
      
    } catch (error) {
      console.error("❌ Error creating utterance:", error);
      setStarting(false);
      alert("Failed to start speech: " + error.message);
      setSpeaking(false);
      setPaused(false);
    }
  };

  const pauseSpeech = () => {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setPaused(true);
      setSpeaking(false);
      
      // Track pause time and update total elapsed time
      if (speechStartTimeRef.current) {
        const now = Date.now();
        const elapsedSinceStart = now - speechStartTimeRef.current;
        totalElapsedTimeRef.current += elapsedSinceStart;
        speechStartTimeRef.current = null;
        pauseTimeRef.current = now;
        
        console.log("⏸ Paused at elapsed time:", totalElapsedTimeRef.current, "ms");
      }
    }
  };

  const resumeSpeech = () => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setPaused(false);
      setSpeaking(true);
      
      // Resume tracking time
      if (pauseTimeRef.current) {
        const pauseDuration = Date.now() - pauseTimeRef.current;
        // Don't add pause duration to elapsed time, just reset start time
        speechStartTimeRef.current = Date.now();
        pauseTimeRef.current = null;
        
        console.log("▶ Resumed, continuing from elapsed time:", totalElapsedTimeRef.current, "ms");
      }
    } else if (chunkedSpeechRef.current && pausedText) {
      // Resume chunked speech from where it paused
      const remainingChunks = textChunksRef.current.slice(currentChunkIndexRef.current);
      if (remainingChunks.length > 0) {
        const remainingText = remainingChunks.join(' ');
        setPaused(false);
        startSpeech(remainingText);
      }
    }
  };

  const stopSpeech = () => {
    window.speechSynthesis.cancel();
    setStarting(false);
    setSpeaking(false);
    setPaused(false);
    setCurrentUtterance(null);
    setPausedText("");
    setPausedPosition(0);
    speechStartTimeRef.current = null;
    pauseTimeRef.current = null;
    totalElapsedTimeRef.current = 0;
    lastUtteranceRef.current = null;
  };

  // Reset when text changes
  useEffect(() => {
    if (!text && (speaking || paused)) {
      stopSpeech();
    }
  }, [text]);

  // Calculate approximate text position based on elapsed time and speed
  const calculateTextPosition = (text, elapsedMs, currentSpeed) => {
    // Rough estimate: average speaking rate is ~150 words per minute
    // At 1.0x speed, that's ~2.5 words per second, ~0.4 seconds per word
    // Average word length is ~5 characters, so ~12.5 characters per second at 1.0x
    
    // Adjust for speed
    const charsPerSecond = 12.5 * currentSpeed;
    const elapsedSeconds = elapsedMs / 1000;
    const approximateChars = Math.floor(charsPerSecond * elapsedSeconds);
    
    // Don't exceed text length
    return Math.min(approximateChars, text.length);
  };

  // Update speed if currently speaking - resume from current position
  useEffect(() => {
    // Only restart if speed actually changed and speech is active
    const speedChanged = prevSpeedRef.current !== speed;
    const speechActive = (speaking || paused) && pausedText;
    
    if (speedChanged && speechActive) {
      const wasPaused = paused;
      const fullText = pausedText;
      
      // Calculate elapsed time up to now - FIRST update the ref if currently speaking
      if (speechStartTimeRef.current && !wasPaused) {
        // Currently speaking - update total elapsed time before calculating position
        const now = Date.now();
        const elapsedSinceStart = now - speechStartTimeRef.current;
        totalElapsedTimeRef.current += elapsedSinceStart;
        speechStartTimeRef.current = now; // Reset start time for next calculation
      }
      
      // Use the updated total elapsed time
      const totalElapsed = totalElapsedTimeRef.current;
      
      // Calculate approximate position based on previous speed
      const positionAtOldSpeed = calculateTextPosition(fullText, totalElapsed, prevSpeedRef.current);
      
      // Get remaining text from the approximate position
      // Try to start from word boundary for better speech continuity
      let remainingText = fullText.substring(positionAtOldSpeed);
      
      // Try to find word boundary (space) near the position for better continuity
      if (positionAtOldSpeed > 0 && positionAtOldSpeed < fullText.length) {
        // Look for next space within 20 chars
        const searchStart = Math.max(0, positionAtOldSpeed - 10);
        const searchEnd = Math.min(fullText.length, positionAtOldSpeed + 20);
        const searchText = fullText.substring(searchStart, searchEnd);
        const spaceIndex = searchText.indexOf(' ');
        
        if (spaceIndex > 0) {
          remainingText = fullText.substring(searchStart + spaceIndex + 1);
          console.log("📍 Resuming from word boundary at position:", searchStart + spaceIndex + 1);
        } else {
          // No space found, use character position
          remainingText = fullText.substring(positionAtOldSpeed);
          console.log("📍 Resuming from character position:", positionAtOldSpeed);
        }
      }
      
      // Stop current speech
      window.speechSynthesis.cancel();
      setSpeaking(false);
      setPaused(false);
      
      // Update elapsed time based on approximate position with new speed
      // Estimate how long the spoken portion would take at new speed
      const spokenPortion = fullText.substring(0, fullText.length - remainingText.length);
      const estimatedTimeAtNewSpeed = (spokenPortion.length / (12.5 * speed)) * 1000;
      totalElapsedTimeRef.current = estimatedTimeAtNewSpeed;
      
      // Update paused text to remaining text
      setPausedText(remainingText);
      
      // Restart with remaining text and new speed after a brief delay
      setTimeout(() => {
        if (remainingText.trim()) {
          startSpeech(remainingText);
          
          // If it was paused, pause it again immediately
          if (wasPaused) {
            setTimeout(() => {
              if (window.speechSynthesis.speaking) {
                window.speechSynthesis.pause();
                setPaused(true);
                setSpeaking(false);
                pauseTimeRef.current = Date.now();
              }
            }, 50);
          }
        } else {
          // All text has been spoken
          console.log("✅ All text spoken, speech complete");
          stopSpeech();
        }
      }, 100);
    }
    
    // Update previous speed
    prevSpeedRef.current = speed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed]);

  // Map language codes to Google TTS language codes
  const getGoogleTTSLang = (lang) => {
    const langMap = {
      'hi': 'hi',
      'te': 'te',
      'en': 'en',
      'es': 'es',
      'fr': 'fr',
      'de': 'de',
      'ja': 'ja',
      'zh': 'zh',
      'ar': 'ar',
      'pt': 'pt',
      'ru': 'ru',
    };
    return langMap[lang] || 'en';
  };

  // Download audio directly using Google Translate TTS API with CORS proxy
  const downloadAudio = async () => {
    if (!text || !text.trim() || disabled || !available) return;

    setDownloading(true);

    try {
      // Split text into chunks if too long (Google TTS has ~200 char limit per request)
      const maxLength = 200;
      const chunks = [];
      let currentChunk = '';
      
      // Split by sentences first, then by words if needed
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      
      if (!sentences || sentences.length === 0) {
        // If no sentences found, split by words
        const words = text.split(/\s+/);
        for (const word of words) {
          if ((currentChunk + word).length <= maxLength) {
            currentChunk += word + ' ';
          } else {
            if (currentChunk) {
              chunks.push(currentChunk.trim());
            }
            currentChunk = word + ' ';
          }
        }
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
      } else {
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
              let wordChunk = '';
              for (const word of words) {
                if ((wordChunk + word).length <= maxLength) {
                  wordChunk += word + ' ';
                } else {
                  if (wordChunk) {
                    chunks.push(wordChunk.trim());
                  }
                  wordChunk = word + ' ';
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
      }

      if (chunks.length === 0) {
        throw new Error("No text to convert");
      }

      const googleLang = getGoogleTTSLang(lang);
      const audioBlobs = [];

      // Download audio for each chunk using Google TTS with CORS proxy
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        let chunkDownloaded = false;
        
        // Try different Google TTS endpoints with CORS proxy
        const ttsBaseUrls = [
          `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${googleLang}&client=tw-ob`,
          `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${googleLang}&client=webapp`,
          `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${googleLang}`,
        ];
        
        // CORS proxies to try
        const corsProxies = [
          '', // No proxy - direct (might fail due to CORS)
          'https://api.allorigins.win/raw?url=',
          'https://corsproxy.io/?',
          'https://api.codetabs.com/v1/proxy?quest=',
        ];
        
        for (const baseUrl of ttsBaseUrls) {
          if (chunkDownloaded) break;
          
          for (const proxy of corsProxies) {
            if (chunkDownloaded) break;
            
            try {
              const ttsUrl = proxy ? proxy + encodeURIComponent(baseUrl) : baseUrl;
              
              const response = await fetch(ttsUrl, {
                method: 'GET',
                mode: 'cors',
                credentials: 'omit',
                headers: proxy ? {} : {
                  'Referer': 'https://translate.google.com/',
                },
              });
              
              if (response && response.ok) {
                const audioBlob = await response.blob();
                
                // Validate audio file
                if (audioBlob.size > 100) {
                  // Check file signature to ensure it's audio (but don't read the blob twice)
                  const arrayBuffer = await audioBlob.arrayBuffer();
                  const uint8Array = new Uint8Array(arrayBuffer.slice(0, 10));
                  
                  // Check for audio file signatures
                  const isMP3 = (uint8Array[0] === 0xFF && (uint8Array[1] === 0xFB || uint8Array[1] === 0xF3 || uint8Array[1] === 0xF2)) || 
                               (uint8Array[0] === 0x49 && uint8Array[1] === 0x44 && uint8Array[2] === 0x33); // ID3 tag
                  const isWAV = (uint8Array[0] === 0x52 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46 && uint8Array[3] === 0x46); // RIFF
                  const isWebM = (uint8Array[0] === 0x1A && uint8Array[1] === 0x45 && uint8Array[2] === 0xDF && uint8Array[3] === 0xA3);
                  const isOGG = (uint8Array[0] === 0x4F && uint8Array[1] === 0x67 && uint8Array[2] === 0x67 && uint8Array[3] === 0x53);
                  
                  // Also check for HTML error pages
                  const mightBeHTML = uint8Array[0] === 0x3C && uint8Array[1] === 0x21; // <!
                  
                  if (!mightBeHTML && (isMP3 || isWAV || isWebM || isOGG || audioBlob.size > 1000)) {
                    // Create new blob from validated array buffer
                    const validatedBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
                    audioBlobs.push(validatedBlob);
                    chunkDownloaded = true;
                    break;
                  } else if (!mightBeHTML) {
                    // Try decoding to validate it's audio
                    try {
                      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                      await audioContext.decodeAudioData(arrayBuffer.slice(0));
                      audioContext.close();
                      const validatedBlob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
                      audioBlobs.push(validatedBlob);
                      chunkDownloaded = true;
                      break;
                    } catch (decodeError) {
                      // Not valid audio, continue
                      console.log("Failed to decode audio, trying next...");
                    }
                  }
                }
              }
            } catch (error) {
              // Continue to next proxy/endpoint
              continue;
            }
          }
        }
        
        if (!chunkDownloaded) {
          console.warn(`Could not download chunk ${i + 1}`);
        }
      }

      if (audioBlobs.length === 0) {
        throw new Error("Failed to download any audio chunks. This may be due to CORS restrictions or network issues.");
      }

      // Combine all audio blobs into one
      let finalBlob;
      if (audioBlobs.length === 1) {
        finalBlob = audioBlobs[0];
      } else {
        try {
          // Convert audio blobs to audio buffers and concatenate
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const audioBuffers = [];
          
          for (const blob of audioBlobs) {
            try {
              const arrayBuffer = await blob.arrayBuffer();
              const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
              audioBuffers.push(audioBuffer);
            } catch (decodeError) {
              console.error("Error decoding audio:", decodeError);
              // Skip invalid audio
            }
          }

          if (audioBuffers.length === 0) {
            throw new Error("Failed to decode any audio chunks");
          }

          // Calculate total length
          const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
          const combinedBuffer = audioContext.createBuffer(
            audioBuffers[0].numberOfChannels,
            totalLength,
            audioBuffers[0].sampleRate
          );

          // Copy all buffers into combined buffer
          let offset = 0;
          for (const buffer of audioBuffers) {
            for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
              combinedBuffer.getChannelData(channel).set(buffer.getChannelData(channel), offset);
            }
            offset += buffer.length;
          }

          // Convert back to blob
          const wavBuffer = audioBufferToWav(combinedBuffer);
          finalBlob = new Blob([wavBuffer], { type: 'audio/wav' });
          audioContext.close();
        } catch (combineError) {
          console.error("Error combining audio:", combineError);
          // If combining fails, just download the first blob
          finalBlob = audioBlobs[0];
        }
      }

      // Download the file
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      const fileExtension = audioBlobs.length > 1 ? 'wav' : (finalBlob.type.includes('wav') ? 'wav' : 'mp3');
      a.download = `text-to-speech-${Date.now()}.${fileExtension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setDownloading(false);

    } catch (error) {
      console.error("Error downloading audio:", error);
      setDownloading(false);
      alert(`Failed to download audio: ${error.message || 'Unknown error'}. This may be due to CORS restrictions. Try using the browser's built-in recording feature.`);
    }
  };

  // Convert audio buffer to WAV format
  const audioBufferToWav = (buffer) => {
    const length = buffer.length;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);
    const samples = buffer.getChannelData(0);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);
    
    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
    
    return arrayBuffer;
  };

  if (!available) {
    return (
      <div className="tts-card">
        <div className="card-header">
          <h3>🔊 Text to Speech</h3>
        </div>
        <div className="card-content">
          <p className="error-text">
            Speech synthesis is not available in your browser.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="tts-card">
      <div className="card-header">
        <h3>🔊 Text to Speech</h3>
      </div>
      <div className="card-content">
        {text && (
          <div className="tts-settings">
            <div className="setting-row">
              <label>Speed:</label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="speed-slider"
              />
              <span className="speed-value">{speed.toFixed(1)}x</span>
            </div>
            <div className="setting-row">
              <label>Voice:</label>
              <div className="voice-buttons">
                <button
                  className={`voice-button ${voiceType === "default" ? "active" : ""}`}
                  onClick={() => setVoiceType("default")}
                >
                  Default
                </button>
                <button
                  className={`voice-button ${voiceType === "male" ? "active" : ""}`}
                  onClick={() => setVoiceType("male")}
                >
                  🧑 Male
                </button>
                <button
                  className={`voice-button ${voiceType === "female" ? "active" : ""}`}
                  onClick={() => setVoiceType("female")}
                >
                  👩 Female
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="tts-controls">
          <button
            className={`action-button ${starting ? "loading" : speaking || paused ? "pause" : "success"}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log("🔘 Button clicked!", { text: !!text, disabled, available });
              speak();
            }}
            disabled={disabled || !text || !available || starting}
            type="button"
          >
            {starting ? "⏳ Starting..." : paused ? "▶ Resume" : speaking ? "⏸ Pause" : "▶ Speak Text"}
          </button>
          {(speaking || paused) && (
            <button 
              className="action-button stop" 
              onClick={stopSpeech}
              title="Stop and reset"
            >
              ⏹ Stop
            </button>
          )}
          {text && (
            <button 
              className="download-button" 
              onClick={downloadAudio} 
              disabled={downloading || !text}
              title="Download audio"
            >
              {downloading ? "⏳ Recording..." : "⬇️ Download Audio"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
