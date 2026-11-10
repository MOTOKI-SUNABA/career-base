import Image from "next/image";
import Link from "next/link";
import localFont from "next/font/local";
import brandIcon from "@/app/icon.png";

const brandFont = localFont({
  src: "../assets/fonts/PlusJakartaSans-Variable.ttf",
  display: "swap",
  weight: "200 800",
});

export function BrandHeader() {
  return (
    <header className="brand-header">
      <Link href="/calendar" className={`brand-link ${brandFont.className}`} aria-label="Career Base ホーム">
        <Image src={brandIcon} alt="" width={52} height={52} priority className="brand-icon" />
        <span>Career Base</span>
      </Link>
    </header>
  );
}
