export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { storeUrl, accessToken } = req.body;

  if (!storeUrl || !accessToken) {
    return res.status(400).json({ 
      success: false, 
      error: 'Store URL and Access Token are required' 
    });
  }

  try {
    const cleanUrl = storeUrl.replace('https://', '').replace('http://', '').replace(/\/$/, '');
    const apiUrl = `https://${cleanUrl}/admin/api/2024-01/shop.json`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      return res.status(200).json({ 
        success: true, 
        shopName: data.shop.name,
        domain: data.shop.domain 
      });
    } else {
      const errorText = await response.text();
      return res.status(200).json({ 
        success: false, 
        error: `Connection failed: ${response.status}` 
      });
    }
  } catch (error) {
    return res.status(200).json({ 
      success: false, 
      error: error.message 
    });
  }
}
