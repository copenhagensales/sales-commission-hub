import { useState, useEffect } from "react";
import { ExternalLink, Globe } from "lucide-react";

interface LinkPreviewProps {
  url: string;
}

// Simple regex to detect URLs
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  return matches || [];
}

export function LinkPreview({ url }: LinkPreviewProps) {
  const [hostname, setHostname] = useState<string>("");

  useEffect(() => {
    try {
      const urlObj = new URL(url);
      setHostname(urlObj.hostname);
    } catch {
      setHostname(url);
    }
  }, [url]);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 p-2 mt-2 rounded-md bg-background/20 hover:bg-background/30 transition-colors border border-border/30"
    >
      <Globe className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <span className="text-sm truncate flex-1">{hostname}</span>
      <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-50" />
    </a>
  );
}

interface MessageWithLinksProps {
  content: string;
  className?: string;
}

export function MessageWithLinks({ content, className }: MessageWithLinksProps) {
  // Split content by URLs and render with link styling
  const parts = content.split(URL_REGEX);
  const urls = extractUrls(content);
  
  return (
    <div className={className}>
      <div className="whitespace-pre-wrap break-words">
        {parts.map((part, i) => {
          if (urls.includes(part)) {
            return (
              <a
                key={i}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
              >
                {part}
              </a>
            );
          }
          return <span key={i}>{part}</span>;
        })}
      </div>
      
      {/* Show link previews for first URL only */}
      {urls.length > 0 && <LinkPreview url={urls[0]} />}
    </div>
  );
}
