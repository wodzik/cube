import { Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto px-4 py-6 text-center text-xs text-gray-500">
      <a
        href="https://ko-fi.com/wodziszczakow"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 hover:text-gray-300 transition-colors"
      >
        <Heart size={12} className="text-pink-500" />
        Support me on Ko-fi
      </a>
    </footer>
  );
}
