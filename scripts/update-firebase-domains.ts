const projectId = "coffee-37b81";
const defaultDomains = ["coffee-omega-lovat.vercel.app", "localhost"];

function parseDomains() {
  const domains = process.argv.slice(2).filter(Boolean);
  return domains.length > 0 ? domains : defaultDomains;
}

function printManualSteps(domains: string[]) {
  console.log("Firebase Authorized domains는 Firebase CLI에서 직접 추가하는 전용 명령이 없습니다.");
  console.log("");
  console.log("가장 안전한 방법은 Firebase Console에서 수동으로 추가하는 것입니다:");
  console.log("1. Firebase Console > Authentication > Settings");
  console.log('2. "Authorized domains" 섹션으로 이동');
  console.log('3. "Add domain" 버튼으로 아래 도메인을 추가');
  domains.forEach((domain) => {
    console.log(`   - ${domain}`);
  });
}

function printRestExample(domains: string[]) {
  const configPayload = {
    authorizedDomains: domains,
  };

  console.log("");
  console.log("자동화가 꼭 필요하면 Identity Toolkit Admin REST API를 사용할 수 있습니다.");
  console.log("예시:");
  console.log(`export PROJECT_ID=${projectId}`);
  console.log("export ACCESS_TOKEN=$(gcloud auth print-access-token)");
  console.log("curl -X PATCH \\");
  console.log('  "https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config?updateMask=authorizedDomains" \\');
  console.log('  -H "Authorization: Bearer ${ACCESS_TOKEN}" \\');
  console.log('  -H "Content-Type: application/json" \\');
  console.log(`  -d '${JSON.stringify(configPayload)}'`);
}

const domains = parseDomains();

printManualSteps(domains);
printRestExample(domains);
