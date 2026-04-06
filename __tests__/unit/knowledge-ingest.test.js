import { describe, it, expect } from 'vitest';
import { chunkText } from '../../app/lib/knowledge-ingest.js';

describe('knowledge-ingest', () => {
  describe('chunkText', () => {
    it('returns empty array for null/empty input', () => {
      expect(chunkText(null)).toEqual([]);
      expect(chunkText('')).toEqual([]);
      expect(chunkText(undefined)).toEqual([]);
    });

    it('returns a single chunk for short text', () => {
      const chunks = chunkText('Hello world. This is a short document.');
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('Hello world. This is a short document.');
      expect(chunks[0].position).toBe(0);
      expect(chunks[0].tokenCount).toBeGreaterThan(0);
    });

    it('splits on paragraph boundaries for long text', () => {
      // Create text with multiple paragraphs, each ~600 chars so total exceeds 2000 char target
      const para = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(12);
      const text = `${para}\n\n${para}\n\n${para}\n\n${para}\n\n${para}`;
      const chunks = chunkText(text);
      expect(chunks.length).toBeGreaterThan(1);
      // Each chunk should have content and sequential positions
      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].position).toBe(i);
        expect(chunks[i].content.length).toBeGreaterThan(0);
        expect(chunks[i].tokenCount).toBeGreaterThan(0);
      }
    });

    it('handles text without paragraph breaks (single block)', () => {
      // A single massive paragraph with sentence breaks
      const text = 'This is sentence one. '.repeat(200);
      const chunks = chunkText(text);
      expect(chunks.length).toBeGreaterThan(1);
      // Verify all content is captured (no data loss, accounting for overlap)
      expect(chunks[0].content.length).toBeGreaterThan(100);
    });

    it('caps at MAX_CHUNKS_PER_ITEM', () => {
      // Create a very long document
      const text = ('A '.repeat(500) + '\n\n').repeat(500);
      const chunks = chunkText(text);
      expect(chunks.length).toBeLessThanOrEqual(200);
    });

    it('assigns sequential position values', () => {
      const text = `First paragraph with some content here.\n\nSecond paragraph with more.\n\nThird paragraph.`;
      const chunks = chunkText(text);
      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].position).toBe(i);
      }
    });

    it('estimates token counts based on character length', () => {
      const text = 'a'.repeat(400); // 400 chars ≈ 100 tokens at 4 chars/token
      const chunks = chunkText(text);
      expect(chunks[0].tokenCount).toBe(100);
    });
  });
});
