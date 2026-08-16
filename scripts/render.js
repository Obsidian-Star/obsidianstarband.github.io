const fs = require('fs').promises;
const path = require('path');

const pages = ['index.html','about.html','contact.html','shows.html','songs.html'];
const dataDir = path.join(__dirname, '..', 'data');
const outDir = path.join(__dirname, '..', 'dist');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function renderData(name, opts = {}) {
  const dataPath = path.join(dataDir, name + '.json');
  try {
    const raw = await fs.readFile(dataPath, 'utf8');
    const data = JSON.parse(raw);
    // allow rendering a specific list (upcoming/previous) via opts.listId
    const items = opts.listId && Array.isArray(data[opts.listId]) ? data[opts.listId] : (Array.isArray(data.items) ? data.items : []);

    // build description separately
    const descriptionHtml = data.description ? `<p>${escapeHtml(data.description)}</p>` : '';

    // build members or list
    let contentHtml = '';
    if (items.length === 0) {
      // special-case: upcoming shows should display a friendly placeholder
      if (opts.listId === 'upcoming') {
        contentHtml = `<ul class="show-list"><li class="show-item">Stay Tuned!</li></ul>`;
      } else {
        contentHtml = '';
      }
    } else {
      const looksLikeMembers = items.every(it => it.name && it.role);
      const looksLikeVideos = items.every(it => it.title && it.link);
      function youtubeEmbedUrl(url) {
        try {
          const u = new URL(url);
          if (u.hostname.includes('youtu.be')) return 'https://www.youtube.com/embed/' + u.pathname.slice(1);
          if (u.hostname.includes('youtube.com')) {
            const v = u.searchParams.get('v');
            if (v) return 'https://www.youtube.com/embed/' + v;
            if (u.pathname.startsWith('/embed/')) return url;
          }
        } catch (e) {}
        return url;
      }
      if (looksLikeMembers) {
        items.forEach(member => {
          contentHtml += '<div class="member">';
          if (member.photo) {
            contentHtml += `<img src="${escapeHtml(member.photo)}" alt="${escapeHtml(member.name)}" width="80" height="80">`;
          }
          contentHtml += '<div>';
          contentHtml += `<b>${escapeHtml(member.name)}</b>`;
          contentHtml += ` - ${escapeHtml(member.role)}`;
          if (member.bio) contentHtml += `<br>${escapeHtml(member.bio)}`;
          contentHtml += '</div>';
          contentHtml += '</div>';
        });
      } else if (looksLikeVideos) {
        items.forEach(video => {
          contentHtml += `<div class="video-item"><h3>${escapeHtml(video.title)}</h3>`;
          if (video.embed_html) {
            // trust embed_html as-is (site-managed content)
            contentHtml += video.embed_html;
          } else if (video.link) {
            contentHtml += `<iframe width="560" height="315" src="${escapeHtml(youtubeEmbedUrl(video.link))}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
          }
          contentHtml += `</div>`;
        });
      } else {
        const hasTypes = items.some(it => it.type);
        if (hasTypes) {
          items.forEach(item => {
            const rawType = (item.type || '');
            const lowerType = rawType.toLowerCase();
            const label = rawType.charAt(0).toUpperCase() + rawType.slice(1);
            const val = item.value || '';
            if (lowerType === 'email' || (typeof val === 'string' && val.includes('@') && !val.startsWith('http'))) {
              // Use the Type as the anchor text linking to mailto:
              contentHtml += `<p><a href="mailto:${escapeHtml(val)}">${escapeHtml(label)}</a></p>`;
            } else if (lowerType === 'link' || lowerType === 'url' || (typeof val === 'string' && val.startsWith('http'))) {
              const vals = Array.isArray(val) ? val : [val];
              // For each URL, show an anchor whose text is the Type
              contentHtml += vals.map(v => `<p><a href="${escapeHtml(v)}">${escapeHtml(label)}</a></p>`).join('');
            } else {
              if (typeof val === 'string' && val.startsWith('http')) {
                contentHtml += `<p><a href="${escapeHtml(val)}">${escapeHtml(label)}</a></p>`;
              } else {
                contentHtml += `<p>${escapeHtml(label)}: ${escapeHtml(val || '')}</p>`;
              }
            }
          });
        } else {
          contentHtml += '<ul class="show-list">';
          items.forEach(item => {
            if (item.date && item.venue) {
              contentHtml += `<li class="show-item">${escapeHtml(item.date)} — ${escapeHtml(item.venue)}${item.city ? ', ' + escapeHtml(item.city) : ''}`;
              if (item.notes) contentHtml += ` — ${escapeHtml(item.notes)}`;
              if (item.link) contentHtml += ` <a class="show-link" href="${escapeHtml(item.link)}">Watch</a>`;
              contentHtml += `</li>`;
            } else if (item.title && item.length) {
              contentHtml += `<li class="show-item">${escapeHtml(item.title)} (${escapeHtml(item.length)})</li>`;
            } else if (item.title) {
              contentHtml += `<li class="show-item">${escapeHtml(item.title)}${item.role ? ' — ' + escapeHtml(item.role) : ''}</li>`;
            } else {
              contentHtml += `<li class="show-item">${escapeHtml(JSON.stringify(item))}</li>`;
            }
          });
          contentHtml += '</ul>';
        }
      }
    }

    return { descriptionHtml, contentHtml };
  } catch (err) {
    return { descriptionHtml: '', contentHtml: '' };
  }
}

async function build() {
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });

  // Copy top-level static files (.html and selected assets)
  const rootFiles = await fs.readdir(path.join(__dirname, '..'));
  for (const name of rootFiles) {
    if (name === '.git' || name === 'dist' || name === 'node_modules' || name === '.github' || name === 'scripts') continue;
    const src = path.join(__dirname, '..', name);
    const dest = path.join(outDir, name);
    const stat = await fs.stat(src);
    if (stat.isDirectory()) {
      // copy directory (assets, images, etc.)
      await copyDir(src, dest);
    } else if (name.endsWith('.html') || name.match(/\.(png|jpg|jpeg|gif|mp3|mp4|svg)$/i)) {
      await fs.copyFile(src, dest);
    }
  }

  // For each page, inject rendered content into div#page-content
  for (const page of pages) {
    const srcPath = path.join(__dirname, '..', page);
    try {
      let html = await fs.readFile(srcPath, 'utf8');
      const name = path.basename(page, '.html');
      const rendered = await renderData(name);
      // Inject members/content into #page-content (common case)
      html = html.replace(/<div id="page-content">[\s\S]*?<\/div>/i, `<div id="page-content">${rendered.contentHtml || ''}</div>`);
      // Inject band description into #band-bio if present
      html = html.replace(/<div id="band-bio">[\s\S]*?<\/div>/i, `<div id="band-bio">${rendered.descriptionHtml || ''}</div>`);
      // No special-case injection for songs; songs are managed directly in songs.html
      await fs.writeFile(path.join(outDir, page), html, 'utf8');
    } catch (err) {
      // file might not exist; skip
    }
  }

  console.log('Built dist/ with rendered pages.');
}

async function copyDir(src, dest) {
  try {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        await copyDir(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  } catch (err) {
    // ignore
  }
}

build().catch(err => { console.error(err); process.exit(1); });
