#!/usr/bin/env python3
"""
annotated-prototype-builder - 原型静态校验脚本 v2.0.0
用法: python3 validate_prototype.py <path/to/prototype.html>

校验项:
  1. 单文件自包含（无外部 http(s) 资源引用）
  2. 标注引擎 JS 已注入（v2 抽屉式特征）
  3. 标注引擎 CSS 已注入（v2 抽屉式特征）
  4. 每个 data-annotate 元素的标注文本非空且 ≤ 12 字（主标题）/ 60 字（详情）
  5. data-annotate-type 取值在允许枚举内
  6. 存在至少 1 个 data-annotate 元素
  7. 抽屉容器与按钮特征（保存/收起/展开）存在
  8. data-annotate-section 区块标记格式正确（若存在）
  9. data-page 多页面标记格式正确（若存在）
"""
import re
import sys
from pathlib import Path

ALLOWED_TYPES = {"action", "input", "link", "navigation", "feedback", "data", ""}
TITLE_MAX = 12
DETAIL_MAX = 300
SECTION_MAX = 20
PAGE_ID_MAX = 40


def fail(msg):
    print(f"  ✗ {msg}")
    return False


def ok(msg):
    print(f"  ✓ {msg}")
    return True


def strip_non_html(html):
    """剥离 <script> 与 HTML 注释，避免把引擎源码/注释里的挂载约定示例误判为真实标记"""
    html = re.sub(r'<!--.*?-->', '', html, flags=re.DOTALL)
    html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL | re.IGNORECASE)
    return html


def check_self_contained(html):
    """检查是否引用了外部 http(s) 资源（img src / link href / script src）"""
    pattern = re.compile(
        r'<(?:img[^>]+src|link[^>]+href|script[^>]+src)\s*=\s*["\']https?://',
        re.IGNORECASE,
    )
    matches = pattern.findall(html)
    if matches:
        return fail(f"发现 {len(matches)} 处外部资源引用，必须自包含")
    return ok("无外部资源引用，文件自包含")


def check_engine_js(html):
    """v2 抽屉式 JS 特征：__anno_drawer__ / __anno-drawer / data-annotate-section / __annoGotoPage"""
    keywords = ["__anno_drawer__", "__anno-drawer", "data-annotate-section",
                "__annoGotoPage", "__anno_layer__", "renderForCurrentPage"]
    found = sum(1 for k in keywords if k in html)
    if found < 3:
        return fail(f"标注引擎 JS 未注入或特征不明显（仅命中 {found}/6 项 v2 特征）")
    return ok(f"标注引擎 JS 已注入（命中 {found}/6 项 v2 特征）")


def check_engine_css(html):
    """v2 抽屉式 CSS 特征"""
    keywords = ["__anno-drawer", "__anno-card", "__anno-section-title",
                "__anno-target-dot", "__anno-expand-btn"]
    found = sum(1 for k in keywords if k in html)
    if found < 3:
        return fail(f"标注引擎 CSS 未注入或特征不明显（仅命中 {found}/5 项 v2 特征）")
    return ok(f"标注引擎 CSS 已注入（命中 {found}/5 项 v2 特征）")


def check_drawer_features(html):
    """抽屉容器与按钮特征"""
    all_ok = True
    if '__anno-drawer' not in html:
        all_ok = fail("未找到抽屉容器（.__anno-drawer）")
    if '__anno-btn-save' not in html and '保存' not in html:
        all_ok = fail("未找到保存按钮特征")
    if '__anno-btn-collapse' not in html and '收起' not in html:
        all_ok = fail("未找到收起按钮特征")
    if '__anno-expand-btn' not in html:
        all_ok = fail("未找到收起后展开按钮（.__anno-expand-btn）")
    if all_ok:
        ok("抽屉容器与按钮特征完整（保存/收起/展开）")
    return all_ok


def check_annotations(html):
    """检查所有 data-annotate 元素"""
    tag_re = re.compile(r'<(\w+)([^>]*)>', re.IGNORECASE)
    all_ok = True
    count = 0

    for m in tag_re.finditer(html):
        tag = m.group(1)
        attrs = m.group(2)
        if 'data-annotate' not in attrs:
            continue
        if 'data-annotate-section' in attrs or 'data-annotate-type' in attrs \
                or 'data-annotate-detail' in attrs:
            if 'data-annotate=' not in attrs and 'data-annotate ' not in attrs \
                    and 'data-annotate"' not in attrs:
                continue
        if not re.search(r'data-annotate(\s*=|" )', attrs) and \
           not re.search(r'data-annotate\s*=\s*"', attrs):
            continue

        title_m = re.search(r'data-annotate\s*=\s*"([^"]*)"', attrs)
        if not title_m:
            continue
        count += 1
        title = title_m.group(1)
        if not title.strip():
            all_ok = fail(f"第 {count} 个标注元素 ({tag}) 的 data-annotate 主标题为空")
            continue
        if len(title) > TITLE_MAX:
            all_ok = fail(
                f"第 {count} 个标注 ({title[:8]}…) 主标题 {len(title)} 字 > {TITLE_MAX} 字上限"
            )

        detail_m = re.search(r'data-annotate-detail\s*=\s*"([^"]*)"', attrs)
        if detail_m:
            detail = detail_m.group(1)
            if len(detail) > DETAIL_MAX:
                all_ok = fail(
                    f"第 {count} 个标注 ({title[:8]}…) 详情 {len(detail)} 字 > {DETAIL_MAX} 字上限"
                )

        type_m = re.search(r'data-annotate-type\s*=\s*"([^"]*)"', attrs)
        type_val = type_m.group(1) if type_m else ""
        if type_val not in ALLOWED_TYPES:
            all_ok = fail(
                f"第 {count} 个标注 ({title[:8]}…) 类型 '{type_val}' 不在允许枚举内"
            )

    if count == 0:
        return fail("未发现任何 data-annotate 元素")
    ok(f"共发现 {count} 个标注元素")
    return all_ok


def check_sections(html):
    """检查 data-annotate-section 区块标记"""
    matches = re.findall(r'data-annotate-section\s*=\s*"([^"]*)"', html)
    if not matches:
        ok("无 data-annotate-section 区块标记（标注将归到\"其他\"分组）")
        return True
    all_ok = True
    for i, name in enumerate(matches, 1):
        if not name.strip():
            all_ok = fail(f"第 {i} 个区块标记 data-annotate-section 值为空")
        elif len(name) > SECTION_MAX:
            all_ok = fail(f"第 {i} 个区块名 ({name[:10]}…) {len(name)} 字 > {SECTION_MAX} 字上限")
    if all_ok:
        ok(f"共发现 {len(matches)} 个区块标记，格式正确")
    return all_ok


def check_pages(html):
    """检查 data-page 多页面标记"""
    matches = re.findall(r'data-page\s*=\s*"([^"]*)"', html)
    if not matches:
        ok("无 data-page 多页面标记（按单页处理）")
        return True
    all_ok = True
    for i, pid in enumerate(matches, 1):
        if not pid.strip():
            all_ok = fail(f"第 {i} 个页面标记 data-page 值为空")
        elif len(pid) > PAGE_ID_MAX:
            all_ok = fail(f"第 {i} 个页面 id ({pid[:10]}…) {len(pid)} 字 > {PAGE_ID_MAX} 字上限")
    if all_ok:
        ok(f"共发现 {len(matches)} 个页面标记，格式正确")
    return all_ok


def main():
    if len(sys.argv) < 2:
        print("用法: python3 validate_prototype.py <path/to/prototype.html>")
        sys.exit(2)

    path = Path(sys.argv[1])
    if not path.exists():
        print(f"错误: 文件不存在 {path}")
        sys.exit(2)

    html = path.read_text(encoding="utf-8")
    html_clean = strip_non_html(html)
    print(f"\n校验文件: {path}\n")

    results = [
        check_self_contained(html),
        check_engine_js(html),
        check_engine_css(html),
        check_drawer_features(html),
        check_annotations(html_clean),
        check_sections(html_clean),
        check_pages(html_clean),
    ]

    print()
    if all(results):
        print("✅ 全部校验通过")
        sys.exit(0)
    else:
        failed = sum(1 for r in results if not r)
        print(f"❌ 校验未通过，{failed} 项失败，请根据上述提示修复")
        sys.exit(1)


if __name__ == "__main__":
    main()
