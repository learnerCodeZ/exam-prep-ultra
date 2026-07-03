// 期末刷题宝典 Ultra — Word (.docx) 题库解析器
// 依赖：mammoth.js（浏览器端 docx → 文本）

function parseDocxBank(arrayBuffer, bankName) {
  return mammoth.extractRawText({ arrayBuffer: arrayBuffer })
    .then(function(result) {
      var text = result.value;
      var bank = parseMarkdownBank(text, bankName || 'Word 题库');
      return bank;
    });
}
