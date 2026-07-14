const db = require('../config/db');
const { publicUser } = require('../utils/serialize');
const { enrichPost } = require('./posts.controller');

// GET /api/recommendations/users — корбарони пешниҳодшуда (обунанашуда)
// Мантиқ: "дӯстони дӯстон" аввал, баъд машҳуртаринҳо аз рӯи followers.
function recommendUsers(req, res) {
  const me = req.user.id;
  const rows = db
    .prepare(
      `SELECT u.*,
              (SELECT COUNT(*) FROM follows f2 WHERE f2.following_id = u.id) AS followers,
              (SELECT COUNT(*) FROM follows f3
                 WHERE f3.following_id = u.id
                   AND f3.follower_id IN (SELECT following_id FROM follows WHERE follower_id = @me)
              ) AS mutual
         FROM users u
        WHERE u.id != @me
          AND u.id NOT IN (SELECT following_id FROM follows WHERE follower_id = @me)
        ORDER BY mutual DESC, followers DESC, u.created_at DESC
        LIMIT 20`
    )
    .all({ me });

  res.json({
    users: rows.map((u) => ({
      ...publicUser(u),
      followers: u.followers,
      mutualFollowers: u.mutual,
      reason: u.mutual > 0 ? `${u.mutual} шиносатон обуна аст` : 'Барои шумо пешниҳод',
    })),
  });
}

// GET /api/recommendations/posts — тасмаи "Explore" (постҳои маъмул аз ғайри обунашудаҳо)
function recommendPosts(req, res) {
  const me = req.user.id;
  const rows = db
    .prepare(
      `SELECT p.*, u.username, u.full_name, u.avatar_url, u.is_online,
              (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS score
         FROM posts p JOIN users u ON u.id = p.user_id
        WHERE p.user_id != @me
          AND p.user_id NOT IN (SELECT following_id FROM follows WHERE follower_id = @me)
        ORDER BY score DESC, p.created_at DESC
        LIMIT 30`
    )
    .all({ me });
  res.json({ posts: rows.map((r) => enrichPost(r, me)) });
}

module.exports = { recommendUsers, recommendPosts };
