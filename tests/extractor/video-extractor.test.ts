import { describe, expect, it, vi } from 'vitest';

import { setUI } from '../../src/runtime/context';
import { VideoExtractor } from '../../src/extractor/video-extractor';

describe('video extractor compatibility', () => {
  it('finds the current feed item from the viewport center', () => {
    setUI({ log: vi.fn() });
    document.body.innerHTML = `
      <div data-e2e="feed-item" id="feed">
        <div class="inner">center</div>
      </div>
    `;

    const inner = document.querySelector('.inner');
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: vi.fn(() => inner),
    });

    const feedItem = VideoExtractor.getCurrentFeedItem();
    expect(feedItem?.id).toBe('feed');
  });

  it('extracts the full title without tag text or trailing expand label', () => {
    setUI({ log: vi.fn() });
    document.body.innerHTML = `
      <div data-e2e="feed-item">
        <div class="pQBVl">我想看的内容\n#标签\n展开</div>
      </div>
    `;

    const container = document.querySelector('[data-e2e="feed-item"]') as Element;
    expect(VideoExtractor.getFullTitle(container)).toBe('我想看的内容');
  });
});
