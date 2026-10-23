# TL-M1-003 独立レビュー報告（Claude・初回独立評価）

- 区分：初回独立評価（他方レビュアーの結論・開発会話・統合案は未参照）
- 作成：2026-10-24（レビュー環境の日付）
- 統合担当：Terra Life専用の計画Work。本報告は受入れ判断ではなく、提出位置で停止する。

## 1. 対象の同一性

| 項目 | 値・結果 |
| --- | --- |
| 対象snapshot ID | `TL-M1-003-20261023T014024JST-ff01a355583e`（README-FIRST・REVIEW-REQUEST・manifestで一致） |
| ZIP SHA-256（独立計算） | `f8e9ca2b312d1fc263ef5d5320ab1856015da99aa4fe4ea77105e1708cdf66f9` |
| ZIP SHA-256の照合 | **未照合**。依頼文に値の記載がなく、ZIP外の同名`.sha256`・`.verification.json`も提供されていない。上の値は照合用に記録するのみ |
| 基準commit | `c8cb50d2b19fce2797dddcfddede1d2f5f664d64`（manifest・README-FIRST・verification/source-state-before.jsonのheadで一致）、branch `main` |
| 内部ハッシュ | `sha256sum -c hashes.sha256`：84件すべてOK。manifest.files 83件のサイズ・SHA-256もすべて一致。manifest.files外の収録物はmanifest.jsonとhashes.sha256のみ（設計どおり） |
| 差分の復元 | 隔離ディレクトリでbaseline/に`git -c core.autocrlf=false apply --unsafe-paths diffs/complete-byte-exact.patch`を適用し、worktree/と`diff -r`で完全一致を確認 |
| 収録範囲 | worktree 35件・baseline 32件。baseline→worktreeの差は7件（変更4：.gitignore・README.md・docs/design/TL-M1-DESIGN.md・docs/project-context.md、追加3：docs/tasks/TL-M1-003.md・src/core/progression.ts・tests/progression.test.ts）で、manifest.changesと一致。削除・改名なし |
| 除外 | 旧仕様v0.3.2/v0.3.3、旧タスク3件、過去レビュー2件、.git、node_modules、dist、.npm-cache、生ログ。source-state-before.jsonに除外ファイルのハッシュは記録されているが内容は未収録 |
| 元ZIP | レビュー後に再計算したSHA-256も上と同一。元ZIPは変更していない |

注記：README-FIRST・manifest.scopeの「全変更6件」とmanifest.changesの7件は一致しない。差の1件は.gitignoreの改行のみの変化（CL-04）。

## 2. 確認範囲と順序

独立レビュー方針（worktree/docs/independent-review-policy.md v1.1）に従い、次の順で確認した。

1. specs/source-map.md、specs/TL-M1-003-requirements.md（依頼・採用範囲・AC1〜AC9）
2. specs/birth-adopted-decisions.md、specs/design-applicable-excerpts.md、仕様v0.3.5の第4.1・5.1・6・9・9.1・10.1〜10.4・13.1章（specs/版とworktree/docs版が同一バイトであることを確認）
3. specs/implementation-contract-and-fixtures.md（実装担当による具体化。ACを置き換える正本ではないものとして扱った）
4. コード：src/core/progression.ts（全行）、src/core/birth.ts・random.ts（接続・コピーに使う関数）、src/content/birth-fixture.ts、App.tsx・main.tsx、package.json・lockfile・tsconfig 3種・vite/vitest設定
5. テスト：tests/progression.test.ts（全行）。birth/random testsは基準から不変であることのみ確認
6. 独立実行・追加検証（第3章）→ **ここでAC1〜AC8の初回判断を確定**
7. AC9のため、変更文書3件の差分とdocs/tasks/TL-M1-003.mdの第1〜4章（specs抜粋と全行一致を確認）
8. 初回判断の後に、タスク第5章の自己評価、verification/reported-results-summary.md・limitations.mdを参照し、相違点だけを第6章に記録した

REVIEW-REQUEST.mdは「梱包指示はレビュアーの追加テスト実行許可を定めていない」としているが、本会話の依頼が隔離コピー上での依存再現・テスト・型確認・ビルド・追加検証を明示的に許可しているため、その範囲で実行した。

## 3. 実行環境と独立実行の結果

### 3.1 環境と隔離

- Linux（Ubuntu 24系コンテナ）、Node.js v22.22.2、npm 10.9.7。package.jsonのengines（`^20.19.0 || >=22.12.0`、npm `>=10`）を満たす。実装者報告の環境（Windows、Node v24.22.1、npm 11.19.1）とは異なる。
- ZIPを`/home/claude/review`へ展開し、実行用に`/home/claude/run`（worktreeのコピー）、基準比較用に`/home/claude/runbase`（baselineのコピー）を作った。npmキャッシュも隔離ディレクトリ`/home/claude/npmcache`を指定。
- 依存定義・scriptsの事前確認：package.json・package-lock.jsonは基準から不変。lockfile v3、全resolvedの取得先は`registry.npmjs.org`のみ。install scriptを持つのはmacOS専用のoptional依存`fsevents`だけ。scriptsはdev/typecheck/test/build/previewで、test・typecheck・buildはローカルのvitest/tsc/viteを呼ぶだけ（外部送信なし）。buildはコピー内に`dist/`を生成する。
- 依存再現：`npm ci --ignore-scripts --no-audit --no-fund` → 55パッケージ導入、`npm ls --depth=0`の直接依存9件がlockfileの版と一致（typescript 7.0.2、vite 8.3.4、vitest 4.1.12、react/react-dom 19.3.1ほか）。

### 3.2 結果（すべて本レビューで独立実行）

| コマンド | 実際の結果 |
| --- | --- |
| `npm test`（worktreeコピー） | 終了0。3ファイル・341件成功（birth 126、progression 108、random 107） |
| `npm run typecheck` | 終了0（tsconfig.json・tsconfig.node.json・tsconfig.test.jsonの3回） |
| `npm run build` | 終了0。型確認後、Vite 8.3.4が16 modulesを変換しdist/を生成。生成JSに進行コアは含まれない（UIは未接続のため想定どおり） |
| `npx vitest run`（baselineコピー） | 終了0。2ファイル・233件成功。worktreeの既存2ファイル（233件）と同数で、既存テストの退行なし |
| レビュアー作成の追加プローブ（16件、第5章で参照） | 実行用コピー内の`tests/review/`に一時作成し全件実行。確認後に削除 |
| 静的確認 | progression.tsの依存はbirth.ts・random.tsのみ。Date・Math.random・performance・window・document・localStorage・fetch・Reactの参照なし。tsconfig.test.jsonはsrc/coreをDOM libなしで型確認しており、DOM依存が入れば検出できる構成 |
| 変更文書の相対リンク | 4文書で45件。スナップショット内で25件が実在、残り20件はmanifestで除外された旧タスク・旧仕様・過去レビューを指す（source-state-before.jsonに同パスの記録あり。内容は未確認）。それ以外の欠落0 |

副作用：隔離コピー内のnode_modules・dist・vitestキャッシュ、隔離npmキャッシュの生成のみ。元ZIP・展開した正本ディレクトリ（review/）は変更していない（実行コピーとworktreeの差がnode_modulesだけであることを最後に確認）。

## 4. AC別判定（初回独立評価）

| AC | 判定 | 根拠（コード・独立実行） |
| --- | --- | --- |
| AC1 | 適合 | `connectBirth`（progression.ts L152–169）はphase `draft`を`rejected`、`started`かつseasonIndex 0以外を`invalid-state`にする。person＝origin.initialValues、random＝origin.startRandomの一致を要求。origin・person・randomはそれぞれ`copyBirthDraft`・`values`・`streams`で新しいオブジェクト／配列に再構築され、入力と参照を共有しない。frozen入力・返却値の改変テスト（test L54–74）に加え、person/randomがoriginの配列と同一参照の入力でも出力が分離することをプローブP4dで確認 |
| AC2 | 適合 | `check-health`→`complete-season`の2段階で、seasonIndexの加算は`complete-season`処理（L194）だけ。年齢・季節はseasonIndexから導出し別フィールドを持たない。春夏秋冬翌春と年齢0→1をtest L99–116で照合し、独立実行で成功 |
| AC3 | 適合（前提付き） | 入力の形→診断停止→lifeId→revision→死亡の順に計算前に拒否（L178–184）。拒否結果は`state`を持たず、入力状態はコピー経由で不変。両段階での再送拒否（test L162–172）を確認。前提：コアは純粋関数で、同じ旧状態を再評価すれば同じ結果を返す（プローブP3a）。二重進行にはならないが、呼出し側が受理後の状態へ差し替える責任を持つ（契約に明記済み） |
| AC4 | 適合 | stageは「次に実行する位置」で、JSON往復後も保持。20段階中の位置0〜15を`copyCoreState(JSON)`から再開し、連続実行と`toEqual`で一致（test L117–131）。状態はnumber・string・配列・プレーンオブジェクトのみでJSON安全。死亡状態・診断包絡のJSON往復も検証あり |
| AC5 | 適合 | 健康0は接続時に補正されず、最初の有効入力で`dead`、revision+1、死亡記録1件（seasonIndex・age・season）。季節は加算しない。死亡後は`rejected`で記録は1件のまま。dead状態の境界検証は記録がちょうど1件で値が導出値と一致することを要求（L112–117）。健康0.5/1/100で精神0・資金0でも16段階生存。注記：今回の規則では健康が変化しないため、0歳春以外での死亡は外部スナップショットからのみ到達する（CL-01） |
| AC6 | 概ね適合（CL-01・CL-02、いずれもLow） | 結果区分`accepted`／`rejected`／`invalid-state`／`diagnostic-stop`が分離。不正な外部状態は`invalid-state`と理由だけを返しlastNormalを作らない。revision・seasonIndexの安全整数限界では、失敗した遷移を一切含まない直前状態のコピーと原因（code・lifeId・revision・seasonIndex・stage）を返し、revisionを消費しない。診断包絡の再読込は原因を再導出して照合する。ただし「構造上の妥当性」までの検証で、今回の規則で到達不能な状態も正常として受理する（CL-01）。またgetter付きのメモリ上オブジェクトでは検証後に別の値が格納され得る（CL-02） |
| AC7 | 適合 | 進行は乱数3系列をそのままコピーするだけで消費しない（10季節・再開・死亡で全値不変を確認）。running状態のhistoryは型・検証とも空配列のみ。コアの依存はbirth/randomだけ |
| AC8 | 適合 | 既存233件＋新規108件＝341件、型確認3種、ビルドが本環境でも終了0（第3章）。Windows・Node 24での再現は未確認 |
| AC9 | 概ね適合（CL-04・CL-05、Info） | タスク文書に依頼・AC・実装契約・検証値（値・用途・理由・見直し条件）・結果・残課題を記録。README・project-context・設計は追記中心で、設計本文は改行正規化後の比較で第15章と冒頭1行の追加のみ。仕様本文は不変。project-contextの「現在の許可範囲」は旧文言を置換しているが、現況欄の更新として許容範囲と判断 |

**初回結論**：受入れを妨げる重大度High・Mediumの指摘は見つからなかった。Low 2件はAC6の解釈と境界の堅牢性に関するもので、うちCL-01は仕様判断を要する。

## 5. 指摘

重大度：High＝受入れ前に修正必須／Medium＝受入れ前の対処を推奨／Low＝後続でよいが記録すべき／Info＝情報・整合。確度は事実の再現性と、仕様違反とみなすかの判断を分けて記す。

### CL-01 JSON境界が、今回の規則では到達不能な状態を正常状態として受理する（Low／仕様判断待ち）

- 場所：src/core/progression.ts `normal()` L92–118、`copyCoreState()` L134–147（`advanceCore` L175経由でも同じ）
- 再現条件（プローブで確認、すべて`copyCoreState(...).ok === true`かつ`advanceCore`が`accepted`）：
  - P1a：正常な接続直後の状態をJSON化し、`person.health`だけ70→0に書き換える（origin.initialValues.healthは70のまま）。次の入力で`status: 'dead'`、`cause: 'health-zero'`の正常な死亡として記録される。
  - P1b：`person.funds`・`person.knowledge`・`random.life`をoriginのスナップショットと異なる値にしても受理される。
  - P1c：`{revision: 0, stage: 'complete-season'}`、`{seasonIndex: 100, revision: 0}`、`{seasonIndex: 0, revision: 999}`がいずれも受理・進行する。
  - P1d：running状態で健康0かつ`stage: 'complete-season'`も受理される。
  - P1e：dead状態はrevision 0だけを拒否し（L114）、seasonIndex 0で死亡したのにrevision 5の状態も受理される。
- 根拠：規則ID`tl-m1-003-empty-season-1`の下では人物・乱数は一切変化せず、成功遷移ごとにrevisionが1増える。このため到達可能な状態は、person＝origin.initialValues、random＝origin.startRandom、running時revision＝2×seasonIndex＋（complete-seasonなら1）、dead時はその＋1、健康0のrunningはseasonIndex 0・check-health・revision 0のみ、という履歴の再生なしに局所的に確認できる不変条件を満たす。AC6は「外部から渡された不正データを正常状態と称さない」としている。一方、実装契約は「構造の妥当性検証と到達の証明は別」「カウンターの全履歴照合は行わない」と明記し、後半季節の死亡・整数限界のテストはこの受理を前提に外部スナップショットを直接構築している。dead状態のrevision 0拒否だけが部分的に到達性を見ており、方針が一貫していない。
- 影響：M1は保存を持たないため現時点の実害は小さい。ただし、改変したJSONが「正常な健康0の死亡」として確定し得る。また`season-index-exhausted`の診断停止は、正規の進行ではrevisionが先に上限へ達するため（P1f：40段階後にrevision＝2×seasonIndex）、到達不能な状態からしか発生しない。M3で読込境界にそのまま使うと、不整合なセーブを正常として扱う経路になる。
- 確度：事実は高（再現済み）。AC6違反とみなすかは中（契約で除外を明示しており、AC6の「不正データ」の範囲の解釈に依存）。
- 修正方向（計画Workでの選択事項）：(a) 規則IDに結び付いた上記の局所不変条件を境界検証に加える。その場合、後半季節の死亡や整数限界のテストには製品APIを増やさない別の検証手段が必要になり、「検証のためだけの任意状態変更APIを追加しない」との兼ね合いを判断する必要がある。(b) 現行の「構造上の妥当性のみ」を維持し、AC6の「正常状態」がその意味であることと、`season-index-exhausted`が規則上は到達しないことをタスク文書に明記する。dead状態のrevision 0チェックの位置付けもあわせて整理する。

### CL-02 境界検証が同じフィールドを複数回読み、getter・Proxyを持つ入力では検証後に別の値が格納され得る（Low）

- 場所：src/core/progression.ts `values()` L58–67（検証時に`input[key]`を読み、返却時に`input.health`等を再度読む）、`normal()` L93–107（lifeId・revision・seasonIndex・stageを検証時と構築時に別々に読む）、`connectBirth()` L156・L166（lifeId）。再利用している既存の`copyBirthDraft`・`copyRandomState`（TL-M1-002範囲）にも同じ形がある。
- 再現条件：プローブP4a。JSON化した状態の`person`を、1回目の読取で50、2回目以降はNaNを返すgetterを持つオブジェクトに置き換えて`copyCoreState`を呼ぶと、`ok: true`で`person.health`がNaNの状態が返る。
- 根拠：関数は`unknown`を受ける境界として「Invalid external data never becomes lastNormal」とコメントし（L131–133）、AC6も不正データを正常状態と称さないことを求めている。JSON.parse由来の入力はgetterを持たないため影響を受けない。
- 影響：M2以降でアプリ側がメモリ上の非プレーンオブジェクト（Proxyでラップした状態管理など）を直接渡した場合に限られる。悪用経路としての重要性は低い。
- 確度：高（再現済み）。
- 修正方向：各フィールドを一度だけローカル変数へ読み出し、その値を検証・格納の両方に使う。または境界の入口でプレーンな値へ正規化してから検証する。既存birth/randomの同型箇所は別タスクとして扱うかを判断する。

### CL-03 契約上の分岐の一部にテストがない（Info）

- 場所：tests/progression.test.ts
- 内容：次の分岐は現行テストで直接検証されていない。プローブで挙動が契約どおりであることは確認した。
  - revision＝MAX_SAFE_INTEGERかつ健康0のとき、死亡ではなく`revision-exhausted`の診断停止になる（P2a：`diagnostic-stop`）。
  - lastNormalがdeadの診断包絡を`copyCoreState`が拒否する（L138、P2b：`ok: false`）。
  - 状態と入力がともに不正なときに`invalid-state`を優先する順序。
  - 再開位置16〜19（0〜15と同じパターンのため優先度は低い）。
- 影響：将来の変更で優先順位が変わっても検出できない。
- 修正方向：上記を固定テストとして追加する。

### CL-04 作業ツリーの改行差と変更件数の表記が一致しない（Info）

- 場所：worktree/.gitignore、worktree/README.md、README-FIRST.md、manifest.scope、タスク第5章「変更一覧」
- 内容：.gitignoreは内容が同一で、改行がLF→CRLFに変わっただけ。README.mdもworktreeはCRLF、baselineはLF。git-status-before.txtに.gitignoreは現れず、tracked-git.patchのREADMEも行単位の差分なので、元環境のGit設定（autocrlf等）で正規化されていると推測される。ただしGit設定はZIPに含まれず、未確認。件数表記は「全変更6件」「新規3件＋更新3件」と、バイト単位の7件が併存している。
- 影響：正規化されずにcommitされると全行が改行差分になる可能性がある。レビュー資料の件数の読み違いにもつながる。
- 修正方向：commit前に`git diff --stat`や`git ls-files --eol`で確認し、必要なら`.gitattributes`を検討する。件数は「Git上6件、バイト単位7件（.gitignoreは改行のみ）」のように両方を書く。

### CL-05 恒久文書に一時的なGit状態・レビュー状態が書かれている（Info）

- 場所：README.md（L8・L49相当）、docs/project-context.md（L7–8）、docs/design/TL-M1-DESIGN.md（L13・第15章末尾）
- 内容：「独立レビュー待ち」「未stage・未commit・未push」が3文書に記載されている。受入れ・commit後は事実と食い違う。
- 影響：受入れ時に3か所の更新漏れが起きやすい。
- 修正方向：受入れ統合の際に同時更新する項目として、計画Workのチェックリストに含める。

### 指摘以外の観察（判断材料）

- 二重進行の防止は「呼出し側が受理後の最新状態へ差し替える」前提で成立する。同じ旧状態と同じ入力を再評価しても同一の結果になり（P3a）、2段階進むことはない。M2のタイマーや古いクロージャから入力が来た場合の扱いは後続で確認が必要。
- `-0`の健康・資金は受理され、0として扱われる（健康-0は死亡）。JSON往復で`0`になるが挙動は変わらない。指摘とはしない。
- 入力の未知フィールド（例：`eventInstanceId`）は無視して受理される。現在の唯一の入力種別としては問題ないが、Choose・Expire入力を追加する際に再検討する。
- 後続機能との境界：running状態のhistoryを型・検証とも空配列に固定し、dead状態は死亡記録ちょうど1件に固定している。イベント・冬の補充を加えるには型と境界検証の変更が必要になる。これは規則IDで限定を明示しており、将来の全段階を空の仕組みとして先に作っていない点は依頼どおりと判断する。生存年に最低1件の記録を持つという完成時の契約は文書上維持されている。
- 既存の出生抽選・乱数方式・消費順・fixtureは基準から変更されていない（ファイル単位で同一）。

## 6. 自己報告との区別・相違

次はすべて実装者の報告値であり、本レビューで実行した結果ではない：Windows・PowerShell・Node v24.22.1での初回テスト失敗（EPERM）、初回型確認失敗とその修正、通常権限での341件成功、型確認・ビルド成功、`git diff --check`、リンク45件・欠落0、設計本文の保持照合。

本レビューの独立実行との対応：

- テスト件数341件（107＋126＋108）、型確認・ビルドの成功は、別OS・別Node版の本環境でも一致した。
- リンク45件は本環境でも同数。ただし20件はスナップショット外を指すため、実在の確認は記録上のパスまでにとどまる。
- 相違：タスク第5章は「.gitignoreを含む依存定義・設定は不変」「新規3件＋更新3件」としているが、バイト単位では.gitignoreとREADME.mdの改行が変わっている（CL-04）。
- 自己評価のAC6「外部不正状態にはlastNormalなし」は、JSON由来の入力については本レビューでも成立を確認した。getter入力の例外（CL-02）と、到達不能状態の受理（CL-01）は自己評価に記載がない。

## 7. 未確認事項

- ZIP SHA-256の外部照合値（未提供のため未照合）
- 実装者環境（Windows、Node v24.22.1、npm 11.19.1）および他OSでの再現。本環境はLinux・Node v22.22.2
- 元リポジトリのGit設定（core.autocrlf、.gitattributesの有無）と、commit時の改行正規化の結果
- manifestで除外された20件のリンク先の内容、除外された旧仕様・過去レビューの内容（方針により参照していない）
- 実装時の生ログ（未収録）
- カバレッジ・ミューテーション計測（lockfileにカバレッジ用依存がなく、依存の追加は行っていない）
- M2のアプリ制御・タイマー、M3の保存境界との接続時の挙動
- 元の作業リポジトリが梱包後も不変であること（ZIP外のため確認不能）

## 付記：追加プローブの再現手順

実行用コピーに`tests/review/probe.test.ts`を置き、`npx vitest run tests/review`で実行した（確認後に削除）。主要な再現の要点は次のとおり。

```ts
// P1a: 健康だけを書き換えたJSONが正常な死亡として確定する
const s = JSON.parse(JSON.stringify(init())); s.person.health = 0
copyCoreState(s).ok                    // true
advanceCore(s, { kind: 'advance', lifeId: s.lifeId, expectedRevision: s.revision })
// → accepted / status 'dead' / history [{cause:'health-zero', seasonIndex:0, age:0, season:'spring'}]

// P4a: getterにより検証後の値がNaNになる
let n = 0
s.person = { get health() { return n++ === 0 ? 50 : NaN }, spirit: 1, knowledge: 1, connections: 1, funds: 1 }
copyCoreState(s)                       // ok: true, person.health: NaN
```

`init()`は`createBirthDraft('0123456789abcdef', BIRTH_FIXTURE)`→`startBirth`→`connectBirth(..., 'L')`で作った状態である。
