export default function MessageBubble({ role, content }: { role: "bot" | "user"; content: string }) {
  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"} w-full`}>
      <div
        className={`px-4 py-2 rounded-2xl shadow text-sm max-w-[80%] whitespace-pre-line font-serif
          ${role === "user"
            ? "bg-rosefoam text-bean rounded-br-md"
            : "bg-latte text-espresso rounded-bl-md"}
        `}
      >
        {content}
      </div>
    </div>
  );
} 