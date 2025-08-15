export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { storeUrl, accessToken, mode, limit = 10 } = req.body;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const sendUpdate = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const cleanUrl = storeUrl.replace('https://', '').replace('http://', '').replace(/\/$/, '');
    const baseUrl = `https://${cleanUrl}/admin/api/2024-01`;
    const headers = {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json'
    };

    sendUpdate({ log: '📚 Fetching blogs...', type: 'info' });
    
    const blogsResponse = await fetch(`${baseUrl}/blogs.json`, { headers });
    if (!blogsResponse.ok) {
      throw new Error('Failed to fetch blogs');
    }
    
    const blogsData = await blogsResponse.json();
    const blogs = blogsData.blogs;
    
    sendUpdate({ log: `Found ${blogs.length} blog(s)`, type: 'success' });

    let totalProcessed = 0;
    let totalFixed = 0;
    let issuesFound = 0;
    const processedArticles = [];

    for (const blog of blogs) {
      sendUpdate({ log: `\n📝 Processing blog: ${blog.title}`, type: 'info' });
      
      const articlesResponse = await fetch(
        `${baseUrl}/blogs/${blog.id}/articles.json?limit=250`, 
        { headers }
      );
      
      if (!articlesResponse.ok) {
        sendUpdate({ log: `Failed to fetch articles for ${blog.title}`, type: 'error' });
        continue;
      }
      
      const articlesData = await articlesResponse.json();
      const articles = articlesData.articles.slice(0, limit - totalProcessed);
      
      sendUpdate({ log: `Found ${articles.length} articles to process`, type: 'info' });

      for (const article of articles) {
        if (totalProcessed >= limit) break;
        
        const issues = analyzeArticle(article.content);
        const hasIssues = Object.values(issues).some(v => 
          v === true || (Array.isArray(v) && v.length > 0)
        );

        if (hasIssues) {
          issuesFound++;
          sendUpdate({ 
            log: `🔍 Issues found in: ${article.title.substring(0, 50)}...`, 
            type: 'warning' 
          });

          if (mode === 'fix') {
            const fixedContent = fixArticleContent(article.content, article);
            
            const updateResponse = await fetch(
              `${baseUrl}/blogs/${blog.id}/articles/${article.id}.json`,
              {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                  article: {
                    id: article.id,
                    content: fixedContent
                  }
                })
              }
            );

            if (updateResponse.ok) {
              totalFixed++;
              sendUpdate({ 
                log: `✅ Fixed: ${article.title.substring(0, 50)}...`, 
                type: 'success' 
              });
            } else {
              sendUpdate({ 
                log: `❌ Failed to fix: ${article.title.substring(0, 50)}...`, 
                type: 'error' 
              });
            }

            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            totalFixed++;
            sendUpdate({ 
              log: `Would fix: ${article.title.substring(0, 50)}...`, 
              type: 'info' 
            });
          }
        }

        processedArticles.push({
          blog: blog.title,
          title: article.title,
          issues,
          status: hasIssues ? (mode === 'fix' ? 'Fixed' : 'Would Fix') : 'No Issues'
        });

        totalProcessed++;
      }
    }

    const results = {
      totalProcessed,
      issuesFound,
      fixed: totalFixed,
      articles: processedArticles
    };

    sendUpdate({ 
      log: `\n✅ Process complete! Processed ${totalProcessed} articles, fixed ${totalFixed} issues.`, 
      type: 'success' 
    });
    
    sendUpdate({ results });

  } catch (error) {
    sendUpdate({ log: `❌ Error: ${error.message}`, type: 'error' });
  } finally {
    res.end();
  }
}

function analyzeArticle(content) {
  const issues = {
    multiple_body_tags: false,
    multiple_head_tags: false,
    title_outside_head: false,
    multiple_titles: false,
    missing_alt_text: [],
    broken_structure: false
  };

  if (!content) return issues;

  const bodyMatches = content.match(/<body/gi) || [];
  const headMatches = content.match(/<head/gi) || [];
  const titleMatches = content.match(/<title/gi) || [];
  
  issues.multiple_body_tags = bodyMatches.length > 1;
  issues.multiple_head_tags = headMatches.length > 1;
  issues.multiple_titles = titleMatches.length > 1;
  
  const imgMatches = content.match(/<img[^>]*>/gi) || [];
  imgMatches.forEach(img => {
    if (!img.includes('alt=')) {
      issues.missing_alt_text.push(img);
    }
  });

  if (bodyMatches.length > 0 || headMatches.length > 0) {
    issues.broken_structure = true;
  }

  return issues;
}

function fixArticleContent(content, article) {
  if (!content) return '';

  let fixed = content
    .replace(/<html[^>]*>/gi, '')
    .replace(/<\/html>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<body[^>]*>/gi, '')
    .replace(/<\/body>/gi, '')
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta[^>]*>/gi, '')
    .replace(/<link[^>]*>/gi, '');

  fixed = fixed.replace(/<img([^>]*)>/gi, (match, attributes) => {
    if (!attributes.includes('alt=')) {
      const srcMatch = attributes.match(/src=["']([^"']+)["']/i);
      if (srcMatch) {
        const filename = srcMatch[1].split('/').pop().split('.')[0];
        const altText = filename.replace(/[-_]/g, ' ');
        attributes += ` alt="${altText}"`;
      } else {
        attributes += ' alt="Blog image"';
      }
    }
    
    if (!attributes.includes('loading=')) {
      attributes += ' loading="lazy"';
    }
    
    return `<img${attributes}>`;
  });

  fixed = fixed
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/^\s+|\s+$/g, '');

  return `<div class="blog-content">${fixed}</div>`;
}
