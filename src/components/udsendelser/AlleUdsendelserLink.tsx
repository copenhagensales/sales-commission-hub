import { Link } from "react-router-dom";
import { Send } from "lucide-react";

/** Fælles henvisning fra de gamle skabelonsider til Udsendelser → Tekster. */
export function AlleUdsendelserLink() {
  return (
    <Link to="/udsendelser?tab=tekster" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline">
      <Send className="h-4 w-4" /> Alle udsendelser og tekster
    </Link>
  );
}
