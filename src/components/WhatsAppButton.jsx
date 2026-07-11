// Floating WhatsApp button, fixed to the bottom-right corner of the viewport.
// Rendered once in App.jsx (outside <Routes>) so it appears on every page.
//
// TODO: replace with the real support number, digits only, country code
// first, no "+", no spaces (e.g. South Africa: 27821234567).
const WHATSAPP_NUMBER = "27750466172";
const DEFAULT_MESSAGE = "Hi! I have a question about Course Finder.";

export default function WhatsAppButton({
  phoneNumber = WHATSAPP_NUMBER,
  message = DEFAULT_MESSAGE,
}) {
  const href = `https://wa.me/${phoneNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      title="Chat with us on WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center
                 rounded-full bg-[#25D366] text-white shadow-lg shadow-black/20
                 transition-transform duration-200 ease-out hover:scale-110 hover:bg-[#20BD5A]
                 focus:outline-none focus:ring-4 focus:ring-[#25D366]/40
                 active:scale-95"
    >
      <svg
        viewBox="0 0 32 32"
        className="h-8 w-8"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M16.004 3C9.376 3 4 8.373 4 15c0 2.34.653 4.527 1.786 6.393L4 29l7.8-1.746A11.93 11.93 0 0 0 16.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3Zm0 21.75c-1.96 0-3.79-.55-5.35-1.505l-.384-.228-4.63 1.037 1.06-4.51-.25-.397A9.71 9.71 0 0 1 6.25 15c0-5.385 4.375-9.75 9.754-9.75 5.38 0 9.746 4.365 9.746 9.75s-4.366 9.75-9.746 9.75Zm5.34-7.297c-.293-.147-1.734-.857-2.003-.955-.269-.098-.464-.147-.66.147-.196.293-.758.955-.929 1.15-.171.196-.342.22-.635.073-.293-.147-1.236-.456-2.354-1.454-.87-.776-1.458-1.735-1.629-2.028-.171-.293-.018-.452.129-.598.132-.132.293-.342.44-.514.147-.171.196-.293.293-.489.098-.196.049-.367-.024-.514-.073-.147-.66-1.593-.905-2.182-.238-.573-.48-.495-.66-.504l-.562-.01c-.196 0-.514.073-.783.367-.269.293-1.026 1.003-1.026 2.447 0 1.444 1.05 2.838 1.196 3.034.147.196 2.067 3.156 5.008 4.427.7.302 1.246.483 1.672.618.702.223 1.34.191 1.845.116.563-.084 1.734-.709 1.978-1.393.244-.685.244-1.271.171-1.393-.073-.122-.269-.196-.562-.343Z" />
      </svg>
    </a>
  );
}