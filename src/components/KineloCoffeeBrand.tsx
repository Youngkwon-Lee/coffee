import Link from "next/link";

/** The Kinelo master symbol is reused from physio_app; see docs/KINELO_COFFEE_DESIGN.md. */
export default function KineloCoffeeBrand() {
  return (
    <Link href="/" className="kc-brand" aria-label="Kinelo Coffee 홈">
      <img src="/kinelo-coffee-symbol.svg" width={38} height={38} alt="" aria-hidden="true" />
      <span className="kc-wordmark">Kinelo <span>Coffee</span></span>
    </Link>
  );
}
