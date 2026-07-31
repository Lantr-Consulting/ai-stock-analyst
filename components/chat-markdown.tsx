"use client";

import Markdown from "react-markdown";

/** Styled markdown for analyst chat bubbles. */
export function ChatMarkdown({ text }: { text: string }) {
  return (
    <Markdown
      components={{
        p: (p) => <p className="mb-2 last:mb-0 leading-relaxed" {...p} />,
        strong: (p) => <strong className="font-semibold text-ink" {...p} />,
        em: (p) => <em className="italic" {...p} />,
        ul: (p) => <ul className="mb-2 flex list-disc flex-col gap-1 pl-5 last:mb-0" {...p} />,
        ol: (p) => <ol className="mb-2 flex list-decimal flex-col gap-1 pl-5 last:mb-0" {...p} />,
        li: (p) => <li className="leading-relaxed" {...p} />,
        h1: (p) => <p className="mb-1.5 mt-2 text-sm font-bold first:mt-0" {...p} />,
        h2: (p) => <p className="mb-1.5 mt-2 text-sm font-bold first:mt-0" {...p} />,
        h3: (p) => <p className="mb-1.5 mt-2 text-sm font-bold first:mt-0" {...p} />,
        code: (p) => (
          <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[12px]" {...p} />
        ),
        a: (p) => <a className="text-series-1 underline" {...p} />,
        hr: () => <hr className="my-2 border-hairline" />,
      }}
    >
      {text}
    </Markdown>
  );
}
