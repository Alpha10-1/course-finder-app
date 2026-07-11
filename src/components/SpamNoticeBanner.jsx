/**
 * Prominent, always-visible banner reminding users to check their spam/junk
 * folder for the verification email. Used on both the post-signup "check
 * your inbox" screen and the RequireAuth "verify your email" gate, so the
 * message appears immediately rather than only after a resend attempt.
 */
export default function SpamNoticeBanner({ className = "" }) {
  return (
    <div
      role="note"
      className={`flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-left ${className}`}
    >
      <span className="text-xl leading-none" aria-hidden="true">⚠️</span>
      <div>
        <p className="text-sm font-semibold text-amber-800">
          Can't find the email?
        </p>
        <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
          Check your <span className="font-semibold">spam</span> or{" "}
          <span className="font-semibold">junk</span> folder — verification
          emails sometimes end up there. It's sent from{" "}
          <span className="font-medium">noreply@mycoursefinder.web.app</span>.
          If you still don't see it after a few minutes, use the resend
          button below.
        </p>
      </div>
    </div>
  );
}