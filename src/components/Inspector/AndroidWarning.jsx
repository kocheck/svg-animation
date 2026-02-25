export default function AndroidWarning({ message }) {
  if (!message) return null;

  return (
    <span
      className="android-warning"
      data-testid="android-warning"
      title={message}
      aria-label={message}
    >
      &#x26A0;
    </span>
  );
}
