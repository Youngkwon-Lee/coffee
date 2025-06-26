import { useMemo } from "react";

interface CoffeeRecord {
  id: string;
  beanName: string;
  flavor: string;
  rating: number;
  brewMethod: string;
  createdAt: string | any;
  imageUrl?: string;
  cafe?: string;
  notes?: string;
  flavors?: string[];
}

interface FlavorChartProps {
  records: CoffeeRecord[];
}

export default function FlavorChart({ records }: FlavorChartProps) {
  const flavorData = useMemo(() => {
    // 플레이버 빈도수 계산
    const flavorCount: { [key: string]: number } = {};
    const totalFlavors = records.reduce((count, record) => {
      if (record.flavors && Array.isArray(record.flavors)) {
        record.flavors.forEach(flavor => {
          flavorCount[flavor] = (flavorCount[flavor] || 0) + 1;
        });
        return count + record.flavors.length;
      }
      return count;
    }, 0);

    // 상위 6개 플레이버만 표시
    const topFlavors = Object.entries(flavorCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 6)
      .map(([flavor, count]) => ({
        flavor,
        count,
        percentage: Math.round((count / totalFlavors) * 100)
      }));

    return topFlavors;
  }, [records]);

  const getFlavorEmoji = (flavor: string) => {
    const emojiMap: { [key: string]: string } = {
      "Floral": "🌸",
      "Fruity": "🍑", 
      "Chocolate": "🍫",
      "Nutty": "🥜",
      "Sweet": "🍯",
      "Earthy": "🌱",
      "Citrus": "🍊",
      "Berry": "🫐",
      "Vanilla": "🌿",
      "Spicy": "🌶️",
      "Herbal": "🌿",
      "Caramel": "🍮"
    };
    return emojiMap[flavor] || "☕";
  };

  if (records.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-coffee-light opacity-70">
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-sm">플레이버 차트</p>
          <p className="text-xs opacity-70">기록이 없습니다</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 차트 헤더 */}
      <div className="text-center">
        <h3 className="text-sm font-medium text-coffee-light mb-1">선호 플레이버 분석</h3>
        <p className="text-xs text-coffee-light opacity-70">{records.length}개 기록 기반</p>
      </div>

      {/* 플레이버 바 차트 */}
      <div className="space-y-3">
        {flavorData.map((item, index) => (
          <div key={item.flavor} className="flex items-center space-x-3">
            {/* 플레이버 이름 */}
            <div className="flex items-center space-x-2 w-20 flex-shrink-0">
              <span className="text-lg">{getFlavorEmoji(item.flavor)}</span>
              <span className="text-xs text-coffee-light font-medium truncate">
                {item.flavor}
              </span>
            </div>
            
            {/* 진행 바 */}
            <div className="flex-1 relative">
              <div className="h-2 bg-coffee-medium rounded-full overflow-hidden">
                <div 
                  className="h-full bg-coffee-gold rounded-full transition-all duration-500 ease-out"
                  style={{ 
                    width: `${item.percentage}%`,
                    animationDelay: `${index * 100}ms`
                  }}
                />
              </div>
            </div>
            
            {/* 백분율 */}
            <div className="w-10 text-right">
              <span className="text-xs text-coffee-light opacity-70">
                {item.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 플레이버 요약 */}
      {flavorData.length > 0 && (
        <div className="mt-4 p-3 bg-coffee-medium rounded-lg border border-coffee-gold border-opacity-20">
          <div className="flex items-center justify-between text-xs">
            <span className="text-coffee-light opacity-70">가장 선호하는 플레이버</span>
            <div className="flex items-center space-x-2">
              <span className="text-lg">{getFlavorEmoji(flavorData[0].flavor)}</span>
              <span className="text-coffee-gold font-medium">{flavorData[0].flavor}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 