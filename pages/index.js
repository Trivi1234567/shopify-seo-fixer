import { useState } from 'react';
import Head from 'next/head';

export default function ShopifySEOFixer() {
  const [storeUrl, setStoreUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [logs, setLogs] = useState([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [mode, setMode] = useState('dry-run');
  const [articlesLimit, setArticlesLimit] = useState(10);
  const [showInstructions, setShowInstructions] = useState(true);

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, timestamp: new Date().toISOString() }]);
  };

  const testConnection = async () => {
    try {
      const response = await fetch('/api/shopify/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeUrl, accessToken })
      });
      
      const data = await response.json();
      if (data.success) {
        addLog(`✅ Connected to: ${data.shopName}`, 'success');
        return true;
      } else {
        addLog(`❌ Connection failed: ${data.error}`, 'error');
        return false;
      }
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
      return false;
    }
  };

  const processSite = async () => {
    setProcessing(true);
    setLogs([]);
    setResults(null);
    
    addLog('🔌 Testing connection...', 'info');
    const connected = await testConnection();
    
    if (!connected) {
      setProcessing(false);
      return;
    }

    addLog(`🚀 Starting ${mode === 'dry-run' ? 'analysis' : 'fixes'}...`, 'info');
    
    try {
      const response = await fetch('/api/shopify/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeUrl,
          accessToken,
          mode,
          limit: articlesLimit
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.log) {
                addLog(data.log, data.type || 'info');
              }
              if (data.results) {
                setResults(data.results);
              }
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
    } finally {
      setProcessing(false);
      addLog('✅ Process complete!', 'success');
    }
  };

  const downloadReport = () => {
    if (!results) return;
    
    const csv = convertToCSV(results);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shopify-seo-report-${new Date().toISOString()}.csv`;
    a.click();
  };

  const convertToCSV = (data) => {
    if (!data.articles || data.articles.length === 0) return '';
    
    const headers = ['Blog', 'Article', 'Issues Found', 'Status'];
    const rows = data.articles.map(article => [
      article.blog,
      article.title,
      Object.entries(article.issues || {})
        .filter(([_, value]) => value === true || (Array.isArray(value) && value.length > 0))
        .map(([key]) => key)
        .join('; '),
      article.status
    ]);
    
    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  };

  const resetForNewSite = () => {
    setStoreUrl('');
    setAccessToken('');
    setResults(null);
    setLogs([]);
    setCurrentStep(1);
  };

  return (
    <div className="container">
      <Head>
        <title>Shopify SEO Fixer - Fix Blog Indexing Issues</title>
        <meta name="description" content="Free tool to fix critical SEO and indexing issues in Shopify blog posts" />
      </Head>

      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          padding: 20px;
        }
        
        .container {
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .header {
          text-align: center;
          color: white;
          margin-bottom: 30px;
        }
        
        .header h1 {
          font-size: 2.5em;
          margin-bottom: 10px;
        }
        
        .header p {
          font-size: 1.2em;
          opacity: 0.9;
        }
        
        .main-card {
          background: white;
          border-radius: 20px;
          padding: 30px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        }
        
        .instructions {
          background: #f7f9fc;
          border-radius: 15px;
          padding: 25px;
          margin-bottom: 30px;
          border: 2px solid #e2e8f0;
        }
        
        .instructions h2 {
          color: #2d3748;
          margin-bottom: 20px;
          font-size: 1.5em;
        }
        
        .instruction-step {
          background: white;
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 15px;
          border-left: 4px solid #667eea;
        }
        
        .instruction-step h3 {
          color: #667eea;
          margin-bottom: 10px;
        }
        
        .instruction-step ol {
          margin-left: 20px;
          color: #4a5568;
        }
        
        .instruction-step li {
          margin-bottom: 8px;
          line-height: 1.6;
        }
        
        .code-block {
          background: #2d3748;
          color: #48bb78;
          padding: 10px 15px;
          border-radius: 5px;
          font-family: 'Courier New', monospace;
          margin: 10px 0;
        }
        
        .toggle-instructions {
          background: #667eea;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 1em;
          margin-bottom: 20px;
          transition: all 0.3s;
        }
        
        .toggle-instructions:hover {
          background: #5a67d8;
          transform: translateY(-2px);
        }
        
        .form-section {
          margin-bottom: 30px;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        .form-group label {
          display: block;
          color: #2d3748;
          font-weight: 600;
          margin-bottom: 8px;
        }
        
        .form-group input {
          width: 100%;
          padding: 12px 15px;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          font-size: 1em;
          transition: all 0.3s;
        }
        
        .form-group input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .mode-selector {
          display: flex;
          gap: 15px;
          margin-bottom: 20px;
        }
        
        .mode-option {
          flex: 1;
          padding: 15px;
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.3s;
          text-align: center;
        }
        
        .mode-option.selected {
          border-color: #667eea;
          background: #f7f6ff;
        }
        
        .mode-option h4 {
          color: #2d3748;
          margin-bottom: 5px;
        }
        
        .mode-option p {
          color: #718096;
          font-size: 0.9em;
        }
        
        .action-buttons {
          display: flex;
          gap: 15px;
          margin-top: 25px;
        }
        
        .btn {
          padding: 12px 30px;
          border: none;
          border-radius: 8px;
          font-size: 1em;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }
        
        .btn-primary {
          background: #667eea;
          color: white;
        }
        
        .btn-primary:hover:not(:disabled) {
          background: #5a67d8;
          transform: translateY(-2px);
        }
        
        .btn-secondary {
          background: #48bb78;
          color: white;
        }
        
        .btn-secondary:hover {
          background: #38a169;
          transform: translateY(-2px);
        }
        
        .btn-danger {
          background: #f56565;
          color: white;
        }
        
        .btn-danger:hover {
          background: #e53e3e;
        }
        
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .logs-section {
          margin-top: 30px;
        }
        
        .logs-container {
          background: #1a202c;
          color: #e2e8f0;
          padding: 20px;
          border-radius: 10px;
          max-height: 400px;
          overflow-y: auto;
          font-family: 'Courier New', monospace;
          font-size: 0.9em;
        }
        
        .log-entry {
          margin-bottom: 8px;
          padding: 5px 10px;
          border-radius: 4px;
        }
        
        .log-entry.info {
          color: #90cdf4;
        }
        
        .log-entry.success {
          color: #68d391;
          background: rgba(72, 187, 120, 0.1);
        }
        
        .log-entry.error {
          color: #fc8181;
          background: rgba(245, 101, 101, 0.1);
        }
        
        .log-entry.warning {
          color: #f6d55c;
        }
        
        .results-section {
          margin-top: 30px;
          padding: 25px;
          background: #f7f9fc;
          border-radius: 15px;
        }
        
        .results-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 25px;
        }
        
        .stat-card {
          background: white;
          padding: 20px;
          border-radius: 10px;
          text-align: center;
          border: 2px solid #e2e8f0;
        }
        
        .stat-card h3 {
          color: #718096;
          font-size: 0.9em;
          margin-bottom: 10px;
          text-transform: uppercase;
        }
        
        .stat-card .value {
          color: #2d3748;
          font-size: 2em;
          font-weight: bold;
        }
        
        .processing-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        
        .processing-modal {
          background: white;
          padding: 40px;
          border-radius: 20px;
          text-align: center;
        }
        
        .spinner {
          width: 50px;
          height: 50px;
          border: 5px solid #e2e8f0;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .warning-box {
          background: #fff5f5;
          border: 2px solid #feb2b2;
          border-radius: 10px;
          padding: 15px;
          margin-bottom: 20px;
        }
        
        .warning-box p {
          color: #c53030;
          margin-bottom: 10px;
        }
      `}</style>

      <div className="header">
        <h1>🚀 Shopify SEO Fixer</h1>
        <p>Fix critical indexing issues in your Shopify blog posts</p>
      </div>

      <div className="main-card">
        <button 
          className="toggle-instructions"
          onClick={() => setShowInstructions(!showInstructions)}
        >
          {showInstructions ? '📖 Hide' : '📖 Show'} Setup Instructions
        </button>

        {showInstructions && (
          <div className="instructions">
            <h2>🔧 How to Set Up Your Shopify Private App</h2>
            
            <div className="instruction-step">
              <h3>Step 1: Create a Private App</h3>
              <ol>
                <li>Log in to your Shopify Admin Panel</li>
                <li>Navigate to <strong>Settings</strong> → <strong>Apps and sales channels</strong></li>
                <li>Click on <strong>"Develop apps"</strong> button</li>
                <li>Click <strong>"Create an app"</strong></li>
                <li>Give your app a name like "SEO Fixer"</li>
                <li>Select your email as the App developer</li>
              </ol>
            </div>

            <div className="instruction-step">
              <h3>Step 2: Configure API Permissions</h3>
              <ol>
                <li>In your app, go to <strong>"Configuration"</strong> tab</li>
                <li>Click <strong>"Configure"</strong> in the Admin API integration section</li>
                <li>Search and enable these scopes:</li>
                <div className="code-block">
                  ✓ read_content<br />
                  ✓ write_content<br />
                  ✓ read_online_store_pages<br />
                  ✓ write_online_store_pages
                </div>
                <li>Click <strong>"Save"</strong></li>
              </ol>
            </div>

            <div className="instruction-step">
              <h3>Step 3: Install App & Get Access Token</h3>
              <ol>
                <li>Go to <strong>"API credentials"</strong> tab</li>
                <li>Click <strong>"Install app"</strong></li>
                <li>In the Admin API section, you'll see your <strong>Access Token</strong></li>
                <li>Click <strong>"Reveal token once"</strong> and copy it</li>
                <li><strong>⚠️ Important:</strong> Save this token securely - you can only see it once!</li>
              </ol>
            </div>

            <div className="instruction-step">
              <h3>Step 4: Get Your Store URL</h3>
              <p>Your store URL format: <code className="code-block">your-store-name.myshopify.com</code></p>
              <p>You can find this in your browser's address bar when logged into Shopify Admin</p>
            </div>
          </div>
        )}

        <div className="form-section">
          <h2>🔗 Connect Your Shopify Store</h2>
          
          <div className="form-group">
            <label htmlFor="storeUrl">Store URL</label>
            <input
              id="storeUrl"
              type="text"
              placeholder="your-store.myshopify.com"
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              disabled={processing}
            />
          </div>

          <div className="form-group">
            <label htmlFor="accessToken">Access Token</label>
            <input
              id="accessToken"
              type="password"
              placeholder="shpat_xxxxxxxxxxxxxxxxxxxxx"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              disabled={processing}
            />
          </div>

          <div className="form-group">
            <label>Processing Mode</label>
            <div className="mode-selector">
              <div 
                className={`mode-option ${mode === 'dry-run' ? 'selected' : ''}`}
                onClick={() => setMode('dry-run')}
              >
                <h4>🔍 Analyze Only</h4>
                <p>Find issues without making changes</p>
              </div>
              <div 
                className={`mode-option ${mode === 'fix' ? 'selected' : ''}`}
                onClick={() => setMode('fix')}
              >
                <h4>🔧 Fix Issues</h4>
                <p>Automatically fix found issues</p>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="limit">Articles to Process (Max: 50 for free tier)</label>
            <input
              id="limit"
              type="number"
              min="1"
              max="50"
              value={articlesLimit}
              onChange={(e) => setArticlesLimit(parseInt(e.target.value) || 10)}
              disabled={processing}
            />
          </div>

          {mode === 'fix' && (
            <div className="warning-box">
              <p>⚠️ <strong>Warning:</strong> Fix mode will modify your blog content!</p>
              <p>• Always test with "Analyze Only" first</p>
              <p>• Consider backing up your content</p>
              <p>• Changes cannot be automatically undone</p>
            </div>
          )}

          <div className="action-buttons">
            <button 
              className="btn btn-primary"
              onClick={processSite}
              disabled={!storeUrl || !accessToken || processing}
            >
              {processing ? 'Processing...' : `Start ${mode === 'dry-run' ? 'Analysis' : 'Fixing'}`}
            </button>
            
            {results && (
              <>
                <button 
                  className="btn btn-secondary"
                  onClick={downloadReport}
                >
                  📥 Download Report
                </button>
                <button 
                  className="btn btn-danger"
                  onClick={resetForNewSite}
                >
                  🔄 Process Another Site
                </button>
              </>
            )}
          </div>
        </div>

        {logs.length > 0 && (
          <div className="logs-section">
            <h3>📋 Process Log</h3>
            <div className="logs-container">
              {logs.map((log, index) => (
                <div key={index} className={`log-entry ${log.type}`}>
                  {log.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {results && (
          <div className="results-section">
            <h2>📊 Results Summary</h2>
            <div className="results-summary">
              <div className="stat-card">
                <h3>Total Processed</h3>
                <div className="value">{results.totalProcessed || 0}</div>
              </div>
              <div className="stat-card">
                <h3>Issues Found</h3>
                <div className="value">{results.issuesFound || 0}</div>
              </div>
              <div className="stat-card">
                <h3>Articles Fixed</h3>
                <div className="value">{results.fixed || 0}</div>
              </div>
              <div className="stat-card">
                <h3>Success Rate</h3>
                <div className="value">
                  {results.totalProcessed > 0 
                    ? `${Math.round((results.fixed / results.totalProcessed) * 100)}%`
                    : '0%'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {processing && (
        <div className="processing-overlay">
          <div className="processing-modal">
            <div className="spinner"></div>
            <h3>Processing your blog posts...</h3>
            <p>This may take a few minutes depending on the number of articles</p>
          </div>
        </div>
      )}
    </div>
  );
}
