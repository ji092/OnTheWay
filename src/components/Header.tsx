export default function Header({ right }: { right?: React.ReactNode }) {
  return (
    <header className="header">
      <div>
        <h1 className="brand">On The Way</h1>
        <p className="tagline">가는 길에</p>
      </div>
      {right}
    </header>
  );
}
