import { useEffect, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { api } from '../api/api.js'
import ChartCard from '../components/ChartCard.jsx'
import LoadingState from '../components/LoadingState.jsx'

export default function CommunityDiscussions({ auth }) {
  const [posts, setPosts] = useState(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [commentBodies, setCommentBodies] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadPosts()
  }, [])

  function loadPosts() {
    api.discussions()
      .then((data) => setPosts(data.posts))
      .catch((loadError) => setError(loadError.message))
  }

  async function submitPost(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const response = await api.createDiscussion({ title, body })
      setPosts((current) => [response.post, ...(current || [])])
      setTitle('')
      setBody('')
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setLoading(false)
    }
  }

  async function submitComment(postId) {
    const commentBody = (commentBodies[postId] || '').trim()
    if (!commentBody) return

    setError('')
    try {
      const response = await api.createDiscussionComment(postId, { body: commentBody })
      setPosts((current) => current.map((post) => (
        post.id === postId
          ? { ...post, comments: [...post.comments, response.comment] }
          : post
      )))
      setCommentBodies((current) => ({ ...current, [postId]: '' }))
    } catch (submitError) {
      setError(submitError.message)
    }
  }

  if (!posts) return <LoadingState />

  return (
    <div className="page community-page">
      <div className="page-heading">
        <h2>Community Discussions</h2>
        <p>Share tactics, cave routes, weapon picks, and match notes with other players.</p>
      </div>

      <ChartCard title="New Discussion">
        <form className="discussion-form" onSubmit={submitPost}>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" />
          <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a message..." rows={4} />
          {error && <p className="login-error">{error}</p>}
          <button className="login-button discussion-submit" type="submit" disabled={loading}>
            <Send size={17} />
            {loading ? 'Posting...' : 'Post Message'}
          </button>
        </form>
      </ChartCard>

      <div className="discussion-list">
        {posts.length === 0 && (
          <ChartCard title="No Discussions Yet">
            <p className="muted">Be the first player to start a thread.</p>
          </ChartCard>
        )}

        {posts.map((post) => (
          <section className="discussion-post" key={post.id}>
            <div className="discussion-post-header">
              <MessageCircle size={19} />
              <div>
                <h3>{post.title}</h3>
                <p>{post.author} · {formatDate(post.created_at)}</p>
              </div>
            </div>
            <p className="discussion-body">{post.body}</p>

            <div className="comments-list">
              {post.comments.map((comment) => (
                <article className="comment-card" key={comment.id}>
                  <strong>{comment.author}</strong>
                  <span>{formatDate(comment.created_at)}</span>
                  <p>{comment.body}</p>
                </article>
              ))}
            </div>

            <div className="comment-form">
              <input
                value={commentBodies[post.id] || ''}
                onChange={(event) => setCommentBodies((current) => ({ ...current, [post.id]: event.target.value }))}
                placeholder={`Comment as ${auth?.user?.username || 'player'}`}
              />
              <button type="button" onClick={() => submitComment(post.id)}>Comment</button>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function formatDate(value) {
  return new Date(value).toLocaleString('ro-RO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
