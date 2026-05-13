const OWNER   = 'usama450';
const REPO    = 'smart-fashion';
const BRANCH  = 'master';
const DB_PATH = 'data/products.json';

function gh(path, opts = {}) {
  return fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
    {
      ...opts,
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'SmartFashion/1.0',
        ...(opts.headers || {})
      }
    }
  );
}

async function readDB() {
  const res = await gh(DB_PATH);
  if (!res.ok) return { rows: [], sha: null };
  const { content, sha } = await res.json();
  return { rows: JSON.parse(Buffer.from(content, 'base64').toString()), sha };
}

async function writeDB(rows, sha) {
  const res = await gh(DB_PATH, {
    method: 'PUT',
    body: JSON.stringify({
      message: 'Update products',
      content: Buffer.from(JSON.stringify(rows, null, 2)).toString('base64'),
      branch: BRANCH,
      ...(sha && { sha })
    })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`writeDB failed: ${JSON.stringify(err)}`);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: public product list ──────────────────────────────
  if (req.method === 'GET') {
    try {
      const { rows } = await readDB();
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
      return res.json(rows);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── Auth guard for writes ─────────────────────────────────
  if (req.headers['x-admin-token'] !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── POST: add product ─────────────────────────────────────
  if (req.method === 'POST') {
    const { name, category, price, description, stock, imageBase64 } = req.body || {};
    if (!name || !category || !price) {
      return res.status(400).json({ error: 'Missing required fields: name, category, price' });
    }

    let image_url  = '';
    let image_path = '';

    if (imageBase64) {
      const base64   = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      image_path = `data/images/${filename}`;

      const imgRes = await gh(image_path, {
        method: 'PUT',
        body: JSON.stringify({
          message: `Add image ${filename}`,
          content: base64,
          branch: BRANCH
        })
      });

      if (!imgRes.ok) {
        const err = await imgRes.json();
        return res.status(500).json({ error: 'Image upload failed', detail: err.message || err });
      }

      image_url = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${image_path}`;
    }

    try {
      const { rows, sha } = await readDB();
      const product = {
        id:          `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name,
        category,
        price,
        description: description || '',
        stock:       stock || 'In Stock',
        image_url,
        image_path,
        created_at:  new Date().toISOString()
      };
      rows.unshift(product);
      await writeDB(rows, sha);
      return res.json(product);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── DELETE: remove product ────────────────────────────────
  if (req.method === 'DELETE') {
    const id = req.query?.id || new URL(req.url, 'http://x').searchParams.get('id');
    if (!id) return res.status(400).json({ error: 'Missing id' });

    try {
      const { rows, sha } = await readDB();
      const product = rows.find(p => p.id === id);
      await writeDB(rows.filter(p => p.id !== id), sha);

      if (product?.image_path) {
        const imgRes = await gh(product.image_path);
        if (imgRes.ok) {
          const { sha: imgSha } = await imgRes.json();
          await gh(product.image_path, {
            method: 'DELETE',
            body: JSON.stringify({
              message: `Delete image ${product.image_path}`,
              sha: imgSha,
              branch: BRANCH
            })
          });
        }
      }

      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
