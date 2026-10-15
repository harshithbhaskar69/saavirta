import { hasFlag } from "country-flag-icons";
export function CountryFlag({
  code,
  country,
}: {
  code?: string;
  country?: string;
}) {
  if (!code || !/^[A-Z]{2}$/.test(code) || !hasFlag(code)) return null;
  return (
    <img
      className="country-flag"
      src={`/flags/${code}.svg`}
      width={27}
      height={18}
      alt={`${country ?? code} flag`}
    />
  );
}
