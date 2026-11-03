# Home WSL / coffee process-abort mitigation — 2026-11-03

## Observed, not inferred
- Source: coffee main `6707d553f696c4c2b026dac998f78b9ba07abb5d`.
- Home Windows 10 Pro build 19045, about 16 GiB RAM; WSL 3.0.3.0 / kernel 6.6.87.2-1. Existing `.wslconfig`: memory=8GB, processors=8, swap=8GB, pageReporting=true, autoMemoryReclaim=gradual. No change made to it.
- During readback, Windows free RAM was 0.69–0.75 GiB; vmmem working set about 7.6–7.7 GiB. This is pressure, NOT proof of an OOM event. No matching recent Resource-Exhaustion-Detector event was returned.
- Six existing `wsl-crashes` dumps total about 7.74 GiB: five identify coffee's Python 3.9.25, one Node 24.18.0; filenames record signal 6. They are process dump evidence, not proof that the WSL VM rebooted. Dumps were not read for memory contents, removed, or suppressed.
- A bounded uptime read succeeded (guest uptime about five days); subsequent bounded guest diagnostics failed at WSL launch with `Wsl/Service/WSAETIMEDOUT`. No shutdown, service restart, session kill, or memory-limit change was made.
- Failed coffee run [41365739336](https://github.com/Youngkwon-Lee/coffee/actions/runs/41365739336) reports ChromeDriver exit `-6` during `_setup_driver`.
- Successful coffee run [41524499625](https://github.com/Youngkwon-Lee/coffee/actions/runs/41524499625) restores about 4,162,451,324 bytes of pip cache and 765,726,741 bytes of npm cache onto the persistent Home runner. It initializes EasyOCR for HTML crawlers repeatedly. Installed grpcio is 1.80.0. A Python dump timestamp overlaps Selenium setup, but the run succeeds; this does not identify the exact abort stack.

## Changes
1. Defer EasyOCR import and reader construction until a permitted image actually needs OCR. Keep CPU reader, image filters, text output and graceful optional-library failures. Do not retry a failed model initialization for every image.
2. Skip remote setup-python/setup-node cache restoration only on self-hosted runners; leave local caches and dependency installs intact. Hosted behavior is unchanged. No cache deletion.
3. Bound OMP/BLAS/NumExpr thread pools to one for this job only.
4. Temporarily pin grpcio 1.78.0 only on Linux/Python <3.10. This is a compatibility mitigation for the owner's current Python 3.9 runner, not a claim that gRPC caused every WSL fault. Remove/adjust only after an isolated Linux fork probe succeeds for the proposed replacement.
5. Add a dependency-free synthetic test before the existing credential/setup and production-write steps. No existing validation is removed.

## Validation and limits
- Native Windows Python 3.9: `python scripts/test_crawler_runtime.py` — 10 tests passed. Network requests, browser, optional OCR library/model and Firebase are mocked; no model was run.
- YAML parsed; after removing only the intended env/cache/test additions, all original parsed steps, triggers and operational inputs equal the source workflow.
- pip dry-run resolver targeting Linux x86_64 / Python 3.9 accepts grpcio 1.78.0 with google-cloud-firestore 2.27.0, google-api-core 2.30.3 and grpcio-status 1.78.0. No running environment's dependencies were changed.
- Separate x86_64 Linux synthetic loopback gRPC probe on Python 3.13.5 / grpcio 1.80.0 reproduced child termination `-11` after 11 fork-forcing subprocess calls. This corroborates the upstream error class but is NOT an exact reproduction of the Home Python 3.9 / ChromeDriver `-6` crash. Post-pin Linux runtime comparison remains NOT_RUN.
- Primary upstream report: https://github.com/grpc/grpc/issues/43055 . It documents Linux active-channel fork/exec failures beginning at 1.80.0 and a passing 1.78.0 control.
- Do not run the production crawler to validate this fix: it writes Firestore and sends notifications. A passing synthetic unit suite is not an end-to-end crawling or WSL platform-recovery claim.

## Activation / rollback
This is a review candidate. Existing owner must review/merge before normal scheduled use. No full workflow was dispatched, no production runtime reinstalled, and no WSL restart is authorized by this note. Roll back this scoped commit if the owner observes regression. Keep historical crash evidence until the live runtime is verified.