import React, { useState } from 'react';

// Add deployment URL here
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [productPagesOnly, setProductPagesOnly] = useState(false);
  const [pagesAnalyzed, setPagesAnalyzed] = useState(null);
  const [wordFrequency, setWordFrequency] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setWordFrequency(null);
    setPagesAnalyzed(null);
    
    try {
      const response = await fetch(`${API_URL}/analyze-words`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url,
          productPagesOnly 
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to analyze website');
      }
      
      const data = await response.json();
      setPagesAnalyzed(data.pagesAnalyzed);
      setWordFrequency(data.wordFrequency);
    } catch (err) {
      setError('Failed to analyze website. Please try again.');
    }
    
    setLoading(false);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`${API_URL}/generate-csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wordFrequency
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate CSV file');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = 'word-frequency.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to download CSV file. Please try again.');
    }
    setDownloading(false);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ textAlign: 'center' }}>Website Word Counter</h1>
      
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="url">Website URL:</label>
          <input
            type="text"
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            style={{ width: '100%', padding: '8px', marginTop: '8px' }}
          />
        </div>

        <div style={{ 
          marginTop: '12px',
          padding: '12px',
          backgroundColor: 'white',
          borderRadius: '4px',
          border: '1px solid #dee2e6'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={productPagesOnly}
              onChange={(e) => setProductPagesOnly(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            Only analyze Product pages
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            marginTop: '16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Analyzing...' : 'Count Words'}
        </button>
      </form>

      {error && (
        <div style={{ color: 'red', marginTop: '16px' }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ 
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          border: '1px solid #dee2e6'
        }}>
          <p style={{ margin: 0 }}>Analyzing website... Please wait.</p>
        </div>
      )}

      {wordFrequency !== null && (
        <div style={{ 
          marginTop: '16px', 
          textAlign: 'center',
          padding: '20px',
          backgroundColor: '#d4edda',
          borderRadius: '8px',
          border: '1px solid #c3e6cb'
        }}>
          <h3 style={{ margin: '0', color: '#155724' }}>
            Analysis Complete
          </h3>
          <p style={{ marginTop: '8px', color: '#155724' }}>
            Analyzed {pagesAnalyzed.toLocaleString()} {productPagesOnly ? 'product ' : ''}pages
          </p>
          <button
            onClick={handleDownload}
            disabled={downloading}
            style={{
              padding: '8px 16px',
              marginTop: '12px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: downloading ? 'not-allowed' : 'pointer',
            }}
          >
            {downloading ? 'Generating CSV...' : 'Download Word Count'}
          </button>
        </div>
      )}
    </div>
  );
}

export default App;