export default function LoadingState({ message = "Loading Explorer's Journal..." }) {
  return (
    <div className="loading-state">
      <div className="loader-ring" />
      <p>{message}</p>
    </div>
  )
}
