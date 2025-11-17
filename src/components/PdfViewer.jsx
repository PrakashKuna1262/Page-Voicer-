import React, { useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import "./PdfViewer.css";

// Set worker source - use local worker file from public folder
pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs`;

export default function PdfViewer({
  file,
  currentPage,
  onPageChange,
  onTotalPagesChange,
  onImageReady,
}) {
  const canvasRef = useRef(null);
  const pdfRef = useRef(null);

  useEffect(() => {
    if (!file) return;

    const loadPdf = async () => {
      try {
        const fileUrl = URL.createObjectURL(file);
        const loadingTask = pdfjsLib.getDocument(fileUrl);
        const pdf = await loadingTask.promise;
        pdfRef.current = pdf;

        onTotalPagesChange(pdf.numPages);

        // Load first page if needed
        if (currentPage >= 1 && currentPage <= pdf.numPages) {
          await renderPage(pdf, currentPage);
        }
      } catch (error) {
        console.error("Error loading PDF:", error);
        alert("Error loading PDF: " + error.message);
      }
    };

    loadPdf();

    return () => {
      if (file) {
        URL.revokeObjectURL(URL.createObjectURL(file));
      }
    };
  }, [file]);

  useEffect(() => {
    if (pdfRef.current && currentPage >= 1) {
      renderPage(pdfRef.current, currentPage);
    }
  }, [currentPage]);

  const renderPage = async (pdf, pageNumber) => {
    try {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      // Convert canvas to image data URL for OCR
      const imageDataUrl = canvas.toDataURL("image/png");
      onImageReady(imageDataUrl);
    } catch (error) {
      console.error("Error rendering page:", error);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (pdfRef.current && currentPage < pdfRef.current.numPages) {
      onPageChange(currentPage + 1);
    }
  };

  if (!file) return null;

  const totalPages = pdfRef.current?.numPages || 0;

  return (
    <div className="pdf-viewer-container">
      <div className="pdf-canvas-wrapper">
        <canvas ref={canvasRef} className="pdf-canvas" />
      </div>

      <div className="pdf-navigation">
        <button
          className="nav-button nav-button-prev"
          onClick={handlePrevPage}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          <span className="nav-icon">←</span>
          <span className="nav-text">Previous</span>
        </button>

        <span className="page-info">
          <span className="page-current">{currentPage}</span>
          <span className="page-separator">/</span>
          <span className="page-total">{totalPages || "—"}</span>
        </span>

        <button
          className="nav-button nav-button-next"
          onClick={handleNextPage}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
        >
          <span className="nav-text">Next</span>
          <span className="nav-icon">→</span>
        </button>
      </div>
    </div>
  );
}

