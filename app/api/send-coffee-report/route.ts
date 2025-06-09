import { NextRequest, NextResponse } from 'next/server';

interface CoffeeRecord {
  id: string;
  beanName: string;
  flavor: string;
  rating: number;
  brewMethod: string;
  createdAt: string;
  notes?: string;
  price?: string;
  origin?: string;
}

interface ReportData {
  email: string;
  reportType: 'weekly' | 'monthly' | 'all';
  user: {
    name: string;
    email: string;
  };
  period: {
    start: string;
    end: string;
  };
  statistics: {
    totalCups: number;
    avgRating: string;
    topMethod: string;
    totalDays: number;
  };
  records: CoffeeRecord[];
}

export async function POST(req: NextRequest) {
  try {
    const reportData: ReportData = await req.json();

    // 이메일 HTML 생성
    const emailHtml = generateEmailHtml(reportData);
    
    // 실제 이메일 서비스 연동 (예: SendGrid, Nodemailer 등)
    // 현재는 로그만 출력하고 성공 응답
    console.log('📧 커피 리포트 이메일 전송 요청:');
    console.log('받는 사람:', reportData.email);
    console.log('리포트 타입:', reportData.reportType);
    console.log('통계:', reportData.statistics);
    console.log('기록 수:', reportData.records.length);

    // TODO: 실제 이메일 서비스 연동
    // await sendEmail({
    //   to: reportData.email,
    //   subject: `${reportData.user.name}님의 ${getReportTitle(reportData.reportType)}`,
    //   html: emailHtml
    // });

    return NextResponse.json({ 
      success: true, 
      message: '커피 리포트가 성공적으로 전송되었습니다.' 
    });

  } catch (error) {
    console.error('이메일 전송 실패:', error);
    return NextResponse.json({ 
      error: '이메일 전송에 실패했습니다.' 
    }, { status: 500 });
  }
}

function getReportTitle(reportType: string): string {
  switch (reportType) {
    case 'weekly': return '지난 7일 커피 리포트';
    case 'monthly': return '지난 30일 커피 리포트';
    case 'all': return '전체 커피 여정 리포트';
    default: return '커피 리포트';
  }
}

function generateEmailHtml(data: ReportData): string {
  const { user, period, statistics, records, reportType } = data;
  
  return `
    <!DOCTYPE html>
    <html lang="ko">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${user.name}님의 ${getReportTitle(reportType)}</title>
        <style>
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                line-height: 1.6; 
                color: #333; 
                max-width: 600px; 
                margin: 0 auto; 
                background-color: #f9f7f4;
            }
            .container { 
                background: white; 
                padding: 40px; 
                border-radius: 20px; 
                margin: 20px; 
                box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            }
            .header { 
                text-align: center; 
                margin-bottom: 40px; 
                padding: 30px 20px;
                background: linear-gradient(135deg, #f59e0b, #ea580c);
                border-radius: 15px;
                color: white;
            }
            .stats-grid { 
                display: grid; 
                grid-template-columns: repeat(2, 1fr); 
                gap: 20px; 
                margin: 30px 0; 
            }
            .stat-card { 
                background: #fff7ed; 
                padding: 20px; 
                border-radius: 12px; 
                text-align: center;
                border: 2px solid #fed7aa;
            }
            .stat-number { 
                font-size: 2rem; 
                font-weight: bold; 
                color: #ea580c; 
                margin-bottom: 5px;
            }
            .stat-label { 
                color: #9a3412; 
                font-size: 0.9rem; 
                font-weight: 500;
            }
            .record-item { 
                background: #fef3c7; 
                padding: 15px; 
                margin: 10px 0; 
                border-radius: 10px; 
                border-left: 4px solid #f59e0b;
            }
            .rating-stars { 
                color: #f59e0b; 
                font-size: 1.2rem; 
                margin: 5px 0; 
            }
            .footer { 
                text-align: center; 
                margin-top: 40px; 
                padding: 20px; 
                background: #f3f4f6; 
                border-radius: 10px; 
                color: #6b7280;
            }
            .emoji { font-size: 1.5rem; margin: 0 5px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1><span class="emoji">☕</span>${user.name}님의 커피 여정<span class="emoji">📊</span></h1>
                <p>${getReportTitle(reportType)} (${period.start} ~ ${period.end})</p>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${statistics.totalCups}</div>
                    <div class="stat-label">총 커피 잔</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${statistics.avgRating}</div>
                    <div class="stat-label">평균 평점</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${statistics.topMethod}</div>
                    <div class="stat-label">선호 추출법</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${new Set(records.map(r => r.beanName)).size}</div>
                    <div class="stat-label">다양한 원두</div>
                </div>
            </div>

            <h2><span class="emoji">📚</span>커피 기록들</h2>
            ${records.slice(0, 20).map(record => `
                <div class="record-item">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <strong>${record.beanName}</strong>
                        <span style="font-size: 0.9rem; color: #6b7280;">
                            ${new Date(record.createdAt).toLocaleDateString('ko-KR')}
                        </span>
                    </div>
                    <div class="rating-stars">
                        ${'★'.repeat(record.rating)}${'☆'.repeat(5 - record.rating)}
                    </div>
                    <div style="margin: 5px 0;">
                        <span style="background: #f59e0b; color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem;">
                            ${record.brewMethod}
                        </span>
                    </div>
                    <div style="color: #6b7280; font-size: 0.9rem; margin-top: 5px;">
                        ${record.flavor}
                    </div>
                    ${record.notes ? `<div style="color: #374151; font-size: 0.9rem; margin-top: 5px; font-style: italic;">"${record.notes}"</div>` : ''}
                </div>
            `).join('')}

            ${records.length > 20 ? `
                <div style="text-align: center; margin: 20px 0; color: #6b7280;">
                    ... 그리고 ${records.length - 20}개의 추가 기록들
                </div>
            ` : ''}

            <div class="footer">
                <p><span class="emoji">💌</span>커피와 함께하는 멋진 여정을 계속해보세요!</p>
                <p style="font-size: 0.8rem; margin-top: 10px;">
                    이 리포트는 Coffee Journey 앱에서 자동으로 생성되었습니다.
                </p>
            </div>
        </div>
    </body>
    </html>
  `;
} 