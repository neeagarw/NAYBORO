// Loading placeholders shaped like each screen, so nothing flashes blank while data loads.

const Bar = ({ w = "100%", h = 14, r = 8, className = "" }: { w?: string | number; h?: number; r?: number; className?: string }) => (
  <div className={`animate-pulse bg-line-soft ${className}`} style={{ width: w, height: h, borderRadius: r }} />
);

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-2.5 rounded-[20px] border border-line-soft bg-surface p-4 ${className}`}>{children}</div>;
}

function Row() {
  return (
    <Card className="flex-row items-center">
      <Bar w={48} h={48} r={16} />
      <div className="flex flex-1 flex-col gap-2"><Bar w="45%" /><Bar w="70%" h={12} /></div>
    </Card>
  );
}

function Header({ tabs }: { tabs?: boolean }) {
  return (
    <div className="flex flex-col gap-3 px-5 pb-2 pt-[18px]">
      <div className="flex items-center justify-between"><Bar w={110} h={24} /><Bar w={40} h={40} r={13} /></div>
      <Bar w={150} h={34} r={10} />
      <Bar w={210} h={12} />
      {tabs && <div className="flex gap-2"><Bar w={80} h={40} r={999} /><Bar w={90} h={40} r={999} /><Bar w={100} h={40} r={999} /></div>}
    </div>
  );
}

function Nav() {
  return (
    <div className="grid grid-cols-3 border-t border-line-soft bg-surface px-2 pb-5 pt-3">
      {[0, 1, 2].map((i) => <div key={i} className="flex flex-col items-center gap-1.5"><Bar w={24} h={22} r={6} /><Bar w={44} h={10} /></div>)}
    </div>
  );
}

export function ScreenSkeleton({ kind = "list" }: { kind?: "list" | "feed" | "profile" | "chat" | "form" }) {
  return (
    <div className="app-frame" aria-busy="true" aria-label="Loading">
      {kind === "list" && (
        <>
          <Header tabs />
          <div className="flex flex-1 flex-col gap-3.5 overflow-hidden px-5 pt-1.5"><Card><Bar w="35%" /><Bar w="80%" /><Bar h={44} r={14} /></Card><Row /><Row /><Row /></div>
          <Nav />
        </>
      )}
      {kind === "feed" && (
        <>
          <Header tabs />
          <div className="flex flex-1 flex-col gap-3.5 overflow-hidden px-5 pt-1.5">
            {[0, 1].map((i) => <Card key={i}><Bar w="40%" h={12} /><Bar w="90%" h={18} /><Bar w="70%" h={18} /><Bar h={64} r={16} /></Card>)}
          </div>
          <Nav />
        </>
      )}
      {kind === "profile" && (
        <div className="flex flex-1 flex-col gap-3.5 overflow-hidden px-5 pt-4">
          <div className="flex justify-between"><Bar w={44} h={44} r={14} /><Bar w={44} h={44} r={14} /></div>
          <Card className="items-center py-6"><Bar w={104} h={104} r={32} /><Bar w={140} h={28} /><Bar w={170} /></Card>
          <Card><Bar w="40%" h={12} /><div className="grid grid-cols-2 gap-2"><Bar h={70} r={16} /><Bar h={70} r={16} /></div></Card>
          <Card><Bar w="25%" h={12} /><Bar /><Bar w="80%" /></Card>
        </div>
      )}
      {kind === "chat" && (
        <>
          <div className="flex items-center gap-2.5 border-b border-line-soft bg-surface px-3.5 py-3.5"><Bar w={44} h={44} r={14} /><Bar w={44} h={44} r={14} /><div className="flex flex-1 flex-col gap-2"><Bar w="40%" /><Bar w="60%" h={11} /></div></div>
          <div className="flex flex-1 flex-col gap-3 px-4 pt-4">
            <Bar w="55%" h={44} r={20} /><Bar w="60%" h={44} r={20} className="self-end" /><Bar w="70%" h={60} r={20} />
          </div>
          <div className="border-t border-line-soft bg-surface px-3 pb-5 pt-2.5"><Bar h={48} r={16} /></div>
        </>
      )}
      {kind === "form" && (
        <div className="flex flex-1 flex-col gap-5 px-5 pt-4">
          <Bar w={44} h={44} r={14} />
          <Bar w="60%" h={34} r={10} /><Bar w="85%" />
          <Bar h={120} r={18} /><Bar h={52} r={16} /><Bar h={52} r={16} />
        </div>
      )}
    </div>
  );
}
