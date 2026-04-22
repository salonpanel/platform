import { BookFastMarkAnimated } from "./BookFastMarkAnimated";

type BookFastLoadingMarkProps = {
  /** Tamaño del isotipo (tres rayas, Brand Kit-print). */
  size?: number;
  /**
   * `mark-and-spinner`: animación completa (onda + halo + respiro).
   * `mark`: animación más suave y sin halo (cabeceras / skeleton).
   */
  variant?: "mark" | "mark-and-spinner";
  className?: string;
};

export function BookFastLoadingMark({
  size = 96,
  variant = "mark-and-spinner",
  className = "",
}: BookFastLoadingMarkProps) {
  const full = variant === "mark-and-spinner";
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 ${className}`}
    >
      <BookFastMarkAnimated
        size={size}
        intensity={full ? "normal" : "subtle"}
        glow={full}
      />
    </div>
  );
}
