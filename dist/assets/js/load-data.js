// Simple helper to load page-specific JSON from /data and render it into the DOM.
(function (global) {
  async function loadPageData(name, opts = {}) {
    // Remove any previous loading state when JS starts a new load
    try { document.documentElement.classList.add('js-loading'); } catch (e) {}
    // Use a repo-relative path (no leading slash) so the loader works when
    // opening files locally, on GitHub Pages under a repo path, and in dist/.
    const base = opts.base || 'data/';
    const url = base + name + '.json';
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch: ' + res.status);
      const data = await res.json();

      const targetId = opts.targetId || 'page-content';
      const target = document.getElementById(targetId);
      if (!target) return data;

      // If there's a band-bio container, populate it from description or bio.
      const bioEl = document.getElementById(opts.bioId || 'band-bio');
      if (bioEl && (data.description || data.bio)) {
        bioEl.innerHTML = '';
        const p = document.createElement('p');
        p.textContent = data.description || data.bio || '';
        bioEl.appendChild(p);
      }

      // Clear target
      target.innerHTML = '';

      // Optionally insert the data.title (skip when caller sets opts.skipTitle)
      if (!opts.skipTitle && data.title) {
        const h = document.createElement('h2');
        h.textContent = data.title;
        target.appendChild(h);
      }

      // Support page-specific lists (e.g., data.upcoming / data.previous)
      const items = opts.listId && Array.isArray(data[opts.listId]) ? data[opts.listId] : (Array.isArray(data.items) ? data.items : []);
      if (items.length === 0) {
          const p = document.createElement('p');
          // If this is the upcoming shows list, show a friendly placeholder
          if (opts.listId === 'upcoming') {
            const ul = document.createElement('ul');
            ul.className = 'show-list';
            const li = document.createElement('li');
            li.className = 'show-item';
            li.textContent = 'Stay Tuned!';
            ul.appendChild(li);
            target.appendChild(ul);
          } else {
            p.textContent = data.description || 'No items.';
            target.appendChild(p);
          }
        return data;
      }
      // If items look like band members, render member cards
        const looksLikeMembers = items.every(it => it.name && it.role);
        const looksLikeVideos = items.every(it => it.title && it.link);
        function youtubeEmbedUrl(url) {
          try {
            // handle youtu.be/ID and youtube.com/watch?v=ID
            const u = new URL(url);
            if (u.hostname.includes('youtu.be')) return 'https://www.youtube.com/embed/' + u.pathname.slice(1);
            if (u.hostname.includes('youtube.com')) {
              const v = u.searchParams.get('v');
              if (v) return 'https://www.youtube.com/embed/' + v;
              // handle /embed/... already
              if (u.pathname.startsWith('/embed/')) return url;
            }
          } catch (e) {}
          return url;
        }
      if (looksLikeMembers) {
        items.forEach(member => {
          const wrap = document.createElement('div');
          wrap.className = 'member';

          if (member.photo) {
            const img = document.createElement('img');
            img.src = (opts.base || 'data/').startsWith('/') ? ('/'+member.photo) : member.photo;
            img.alt = member.name || 'member photo';
            img.width = 80; img.height = 80;
            wrap.appendChild(img);
          }

          const info = document.createElement('div');
          const nameEl = document.createElement('b');
          nameEl.textContent = member.name;
          info.appendChild(nameEl);
          const roleText = document.createTextNode(' - ' + (member.role || ''));
          info.appendChild(roleText);
          if (member.bio) {
            const br = document.createElement('br');
            info.appendChild(br);
            const bio = document.createElement('span');
            bio.textContent = member.bio;
            info.appendChild(bio);
          }

          wrap.appendChild(info);
          target.appendChild(wrap);
        });
      } else if (looksLikeVideos) {
        items.forEach(video => {
          const wrap = document.createElement('div');
          wrap.className = 'video-item';
          const title = document.createElement('h3');
          title.textContent = video.title;
          wrap.appendChild(title);
          if (video.embed_html) {
            // insert raw embed HTML provided in JSON
            const holder = document.createElement('div');
            holder.innerHTML = video.embed_html;
            wrap.appendChild(holder);
          } else if (video.link) {
            const iframe = document.createElement('iframe');
            iframe.width = '560';
            iframe.height = '315';
            iframe.src = youtubeEmbedUrl(video.link);
            iframe.frameBorder = '0';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.allowFullscreen = true;
            wrap.appendChild(iframe);
          }
          target.appendChild(wrap);
        });
      } else {
        // If items contain `type` fields (e.g., contact info), render as paragraphs
        const hasTypes = items.some(it => it.type);
        if (hasTypes) {
          items.forEach(item => {
            const p = document.createElement('p');
            const rawType = (item.type || '');
            const lowerType = rawType.toLowerCase();
            const label = rawType.charAt(0).toUpperCase() + rawType.slice(1);
            const val = item.value || '';

            // Determine how to render the value: email or link
            const renderLabelLink = (href, labelText) => {
              p.innerHTML = ''; // remove prior label text
              const a = document.createElement('a');
              a.href = href;
              a.textContent = labelText;
              p.appendChild(a);
            };

            if (lowerType === 'email' || (typeof val === 'string' && val.includes('@') && !val.startsWith('http'))) {
              renderLabelLink('mailto:' + val, label);
            } else if (lowerType === 'link' || lowerType === 'url' || (typeof val === 'string' && val.startsWith('http'))) {
              // value may be string or array
              const vals = Array.isArray(val) ? val : [val];
              vals.forEach((v, i) => {
                if (i > 0) p.appendChild(document.createTextNode(' '));
                renderLabelLink(v, label);
              });
            } else {
              // If type looks like a social network name but value is a URL, render link
              if (typeof val === 'string' && val.startsWith('http')) {
                renderLabelLink(val, label);
              } else {
                p.textContent = label + ': ' + (val || '');
              }
            }
            target.appendChild(p);
          });
        } else {
          const ul = document.createElement('ul');
          ul.className = 'show-list';
          items.forEach((item) => {
            const li = document.createElement('li');
            li.className = 'show-item';
            // Smart rendering for common shapes
              if (item.date && item.venue) {
                li.textContent = `${item.date} — ${item.venue}${item.city ? ', ' + item.city : ''}`;
                if (item.notes) li.textContent += ` — ${item.notes}`;
                // optional link field (e.g., YouTube)
                if (item.link) {
                  const a = document.createElement('a');
                  a.href = item.link;
                  a.textContent = 'Watch';
                  a.className = 'show-link';
                  li.appendChild(a);
                }
              } else if (item.title && item.length) {
                li.textContent = `${item.title} (${item.length})`;
              } else if (item.title) {
                li.textContent = item.title;
            } else if (item.type && item.value) {
              li.textContent = `${item.type}: ${item.value}`;
            } else {
              li.textContent = JSON.stringify(item);
            }
            ul.appendChild(li);
          });
          target.appendChild(ul);
        }
      }

      // show rendered content (remove loading indicator)
      try { document.documentElement.classList.remove('js-loading'); } catch (e) {}
      return data;
    } catch (err) {
      console.error('loadPageData error', err);
      const target = document.getElementById(opts.targetId || 'page-content');
      if (target) target.textContent = 'Error loading data.';
      try { document.documentElement.classList.remove('js-loading'); } catch (e) {}
      throw err;
    }
  }

  global.loadPageData = loadPageData;
})(window);
