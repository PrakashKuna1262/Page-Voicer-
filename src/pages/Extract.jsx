import React, { useState, useEffect, useRef } from "react";
import PdfViewer from "../components/PdfViewer";
import TextExtractor from "../components/TextExtractor";
import Translator from "../components/Translator";
import TTSPlayer from "../components/TTSPlayer";
import { Link, useLocation } from "react-router-dom";
import "./Extract.css";

export default function Extract() {
  const location = useLocation();
  const pdfInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [pageImage, setPageImage] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [targetLang, setTargetLang] = useState("en"); // Default to English, will be auto-detected
  const [fileType, setFileType] = useState(null); // 'pdf' or 'image'

  // Handle file from navigation state
  useEffect(() => {
    if (location.state?.file) {
      const { file, type } = location.state;
      if (type === "pdf") {
        setPdfFile(file);
        setImageFile(null);
        setFileType("pdf");
        setCurrentPage(1);
        setTotalPages(0);
      } else if (type === "image") {
        setImageFile(file);
        setPdfFile(null);
        setFileType("image");
        setCurrentPage(1);
        setTotalPages(1);
        
        const reader = new FileReader();
        reader.onload = (event) => {
          setPageImage(event.target.result);
        };
        reader.readAsDataURL(file);
      }
      setExtractedText("");
      setTranslatedText("");
    }
  }, [location.state]);

  const handlePdfChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      setImageFile(null);
      setFileType("pdf");
      setCurrentPage(1);
      setTotalPages(0);
      setPageImage(null);
      setExtractedText("");
      setTranslatedText("");
    } else if (file) {
      alert("Please select a valid PDF file");
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      setImageFile(file);
      setPdfFile(null);
      setFileType("image");
      setCurrentPage(1);
      setTotalPages(1); // Images have only 1 "page"
      
      // Convert image to data URL immediately
      const reader = new FileReader();
      reader.onload = (event) => {
        setPageImage(event.target.result);
      };
      reader.readAsDataURL(file);
      
      setExtractedText("");
      setTranslatedText("");
    } else if (file) {
      alert("Please select a valid image file (PNG, JPG, JPEG, etc.)");
    }
  };

  const handlePdfBoxClick = () => {
    pdfInputRef.current?.click();
  };

  const handleImageBoxClick = () => {
    imageInputRef.current?.click();
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages && fileType === "pdf") {
      setCurrentPage(page);
      setPageImage(null);
      setExtractedText("");
      setTranslatedText("");
    }
  };

  const handleImageReady = (imageDataUrl) => {
    setPageImage(imageDataUrl);
  };

  const handleTextExtracted = (text) => {
    setExtractedText(text);
  };

  const handleTextTranslated = (text) => {
    setTranslatedText(text);
  };

  return (
    <div className="extract-page">
      <nav className="extract-nav">
        <Link to="/" className="nav-logo">
          <span className="nav-logo-icon">🎙️</span>
          <span className="nav-logo-text">Page Voicer</span>
        </Link>
        <Link to="/" className="nav-link" title="Back to Home">
          ←
        </Link>
      </nav>

      <main className="extract-main">
        {!(pdfFile || imageFile) ? (
          <div className="upload-boxes-section">
            <div className="upload-boxes-container">
              <div className="upload-box pdf-box" onClick={handlePdfBoxClick}>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handlePdfChange}
                  className="hidden-input"
                />
                <div className="upload-box-icon">📄</div>
                <h2 className="upload-box-title">Upload PDF / Document</h2>
                <p className="upload-box-description">
                  Click or drag PDF files here to extract text from any page
                </p>
                <div className="upload-box-footer">
                  <span className="file-types">Supported: PDF</span>
                </div>
              </div>

              <div className="upload-box image-box" onClick={handleImageBoxClick}>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden-input"
                />
                <div className="upload-box-icon">🖼️</div>
                <h2 className="upload-box-title">Upload Image</h2>
                <p className="upload-box-description">
                  Click or drag image files here to extract text directly
                </p>
                <div className="upload-box-footer">
                  <span className="file-types">Supported: PNG, JPG, JPEG, GIF, WEBP</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="content-section">
            <div className="pdf-section">
              {pdfFile ? (
                <PdfViewer
                  file={pdfFile}
                  currentPage={currentPage}
                  onPageChange={handlePageChange}
                  onTotalPagesChange={setTotalPages}
                  onImageReady={handleImageReady}
                />
              ) : (
                <div className="image-viewer-container">
                  <div className="image-wrapper">
                    <img
                      src={pageImage || URL.createObjectURL(imageFile)}
                      alt="Uploaded"
                      className="uploaded-image"
                    />
                  </div>
                  <div className="image-info">
                    <span className="page-info">Image View</span>
                  </div>
                </div>
              )}
            </div>

            <div className="processing-section">
              <TextExtractor
                image={pageImage}
                onTextExtracted={handleTextExtracted}
                disabled={!pageImage}
              />

              <Translator
                text={extractedText}
                targetLang={targetLang}
                onTargetLangChange={setTargetLang}
                onTranslated={handleTextTranslated}
                disabled={!extractedText}
              />

              <TTSPlayer
                text={translatedText || extractedText}
                lang={translatedText ? targetLang : "en"}
                disabled={!translatedText && !extractedText}
              />
            </div>
          </div>
        )}
      </main>

      <footer className="extract-footer">
        <div className="footer-content">
          <p className="footer-text">
            © 2025 Page Voicer. Made with ❤️ for everyone.
          </p>
        </div>
      </footer>
    </div>
  );
}

