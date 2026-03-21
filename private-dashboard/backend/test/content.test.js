const test = require("node:test");
const assert = require("node:assert/strict");
const { extractFeedItemImage } = require("../src/lib/content");

test("extractFeedItemImage prefers direct enclosure urls", () => {
  const imageUrl = extractFeedItemImage(
    {
      enclosure: {
        url: "https://cdn.example.com/story.jpg",
      },
      description: '<p>Body</p><img src="https://cdn.example.com/fallback.jpg" />',
    },
    "https://example.com/feed.xml",
    "https://example.com/story",
  );

  assert.equal(imageUrl, "https://cdn.example.com/story.jpg");
});

test("extractFeedItemImage resolves relative image urls from html content", () => {
  const imageUrl = extractFeedItemImage(
    {
      content:
        '<div><img src="/images/story-cover.webp" alt="cover" /></div>',
    },
    "https://example.com/feed.xml",
    "https://example.com/posts/story-1",
  );

  assert.equal(imageUrl, "https://example.com/images/story-cover.webp");
});
