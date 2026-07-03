// 期末刷题宝典 Ultra — PDF 题库解析器
// 依赖：pdf.js（Mozilla，浏览器端 PDF 文本提取）

function parsePdfBank(arrayBuffer, bankName) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
  return pdfjsLib.getDocument({ data: arrayBuffer }).promise
    .then(function(pdf) {
      var textPromises = [];
      for (var i = 1; i <= pdf.numPages; i++) {
        textPromises.push(
          pdf.getPage(i).then(function(page) {
            return page.getTextContent().then(function(content) {
              return content.items.map(function(item) { return item.str; }).join(' ');
            });
          })
        );
      }
      return Promise.all(textPromises);
    })
    .then(function(pages) {
      var text = pages.join('\n\n');
      var bank = parseMarkdownBank(text, bankName || 'PDF 题库');
      return bank;
    });
}
