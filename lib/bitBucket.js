"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

let toCompareModels = (() => {
  var _ref = _asyncToGenerator(function* (diff) {
    return new Map(diff.map(function (d) {
      let c = new CompareModel(d);
      return [c.name, c];
    }));
  });

  return function toCompareModels(_x) {
    return _ref.apply(this, arguments);
  };
})();

var _gitUrlParse = require("git-url-parse");

var _gitUrlParse2 = _interopRequireDefault(_gitUrlParse);

var _compare = require("./compare");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const bpr = require("bitbucket-pull-request");

function toTag(tags, version) {
  let v = `v${version}`;
  if (tags.has(v)) {
    return v;
  }
  return tags.has(version) && version;
}

function diffURL(cm, to) {
  if (cm.repo) {
    if (cm.current === to) {
      let tag = toTag(cm.tags, cm.current);
      return tag && `${cm.repo}/tree/${tag}`;
    }
    let ft = toTag(cm.tags, cm.current);
    let tt = toTag(cm.tags, to);
    return ft && tt && `${cm.repo}/compare/${ft}...${tt}`;
  }
  return "";
}

function versionRange(current, to) {
  if (current === to) {
    return current;
  }
  return `${current}...${to}`;
}

class CompareModel {
  constructor(a) {
    var _a = _slicedToArray(a, 5);

    this.name = _a[0];
    this.current = _a[1];
    this.wanted = _a[2];
    this.latest = _a[3];
    this.packageType = _a[4];

    this.repo = "";
    this.homepage = "";
    this.tags = new Set();
  }

  rangeWanted() {
    return versionRange(this.current, this.wanted);
  }

  rangeLatest() {
    return versionRange(this.current, this.latest);
  }

  diffWantedURL() {
    return diffURL(this, this.wanted);
  }

  diffLatestURL() {
    return diffURL(this, this.latest);
  }

  toMarkdown() {
    return (0, _compare.toMarkdown)(this);
  }

  toTextTable() {
    return (0, _compare.toTextTable)(this);
  }
}

exports.default = class {
  constructor(options, remote) {
    this.options = options;
    this.LOG = options.logger;
    this.url = (0, _gitUrlParse2.default)(remote);
  }

  pullRequest(baseBranch, newBranch, diff) {
    this.LOG(`prepare PullRequest ${this.url.toString("https")} ${baseBranch}...${newBranch}`);
    if (this.options.execute) {
      this.LOG("Create Markdown Report for PullRequest.");
      return toCompareModels(diff).then(_compare.toMarkdown).then(markdown => {
        this.LOG("BEGIN Send PullRequest.");
        bpr.create(this.url.owner, // repository user
        this.url.name, // repository name
        `update dependencies at ${this.options.now}`, // title
        markdown, // description
        newBranch, // source branch
        baseBranch // destination branch
        );
        this.LOG("END   Send PullRequest.");
      });
    } else {
      this.LOG("Sending PullRequest is skipped because --execute is not specified.");
      return toCompareModels(this.LOG, this.original, this.options.workingdir, diff).then(_compare.toTextTable);
    }
  }
};
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9iaXRCdWNrZXQuanMiXSwibmFtZXMiOlsiZGlmZiIsIk1hcCIsIm1hcCIsImMiLCJDb21wYXJlTW9kZWwiLCJkIiwibmFtZSIsInRvQ29tcGFyZU1vZGVscyIsImJwciIsInJlcXVpcmUiLCJ0b1RhZyIsInRhZ3MiLCJ2ZXJzaW9uIiwidiIsImhhcyIsImRpZmZVUkwiLCJjbSIsInRvIiwicmVwbyIsImN1cnJlbnQiLCJ0YWciLCJmdCIsInR0IiwidmVyc2lvblJhbmdlIiwiY29uc3RydWN0b3IiLCJhIiwid2FudGVkIiwibGF0ZXN0IiwicGFja2FnZVR5cGUiLCJob21lcGFnZSIsIlNldCIsInJhbmdlV2FudGVkIiwicmFuZ2VMYXRlc3QiLCJkaWZmV2FudGVkVVJMIiwiZGlmZkxhdGVzdFVSTCIsInRvTWFya2Rvd24iLCJ0b1RleHRUYWJsZSIsIm9wdGlvbnMiLCJyZW1vdGUiLCJMT0ciLCJsb2dnZXIiLCJ1cmwiLCJwdWxsUmVxdWVzdCIsImJhc2VCcmFuY2giLCJuZXdCcmFuY2giLCJ0b1N0cmluZyIsImV4ZWN1dGUiLCJ0aGVuIiwibWFya2Rvd24iLCJjcmVhdGUiLCJvd25lciIsIm5vdyIsIm9yaWdpbmFsIiwid29ya2luZ2RpciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OytCQWlFQSxXQUErQkEsSUFBL0IsRUFBcUM7QUFDbkMsV0FBTyxJQUFJQyxHQUFKLENBQ0xELEtBQUtFLEdBQUwsQ0FBUyxhQUFLO0FBQ1osVUFBSUMsSUFBSSxJQUFJQyxZQUFKLENBQWlCQyxDQUFqQixDQUFSO0FBQ0EsYUFBTyxDQUFDRixFQUFFRyxJQUFILEVBQVNILENBQVQsQ0FBUDtBQUNELEtBSEQsQ0FESyxDQUFQO0FBTUQsRzs7a0JBUGNJLGU7Ozs7O0FBakVmOzs7O0FBQ0E7Ozs7OztBQUNBLE1BQU1DLE1BQU1DLFFBQVEsd0JBQVIsQ0FBWjs7QUFFQSxTQUFTQyxLQUFULENBQWVDLElBQWYsRUFBcUJDLE9BQXJCLEVBQThCO0FBQzVCLE1BQUlDLElB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QixZQUFJeUMsTUFBSixDQUNFLEtBQUtSLEdBQUwsQ0FBU1MsS0FEWCxFQUNrQjtBQUNoQixhQUFLVCxHQUFMLENBQVNuQyxJQUZYLEVBRWlCO0FBQ2Qsa0NBQXlCLEtBQUsrQixPQUFMLENBQWFjLEdBQUksRUFIN0MsRUFHZ0Q7QUFDOUNILGdCQUpGLEVBSVk7QUFDVkosaUJBTEYsRUFLYTtBQUNYRCxrQkFORixDQU1hO0FBTmI7QUFRQSxhQUFLSixHQUFMLENBQVMseUJBQVQ7QUFDRCxPQWJJLENBQVA7QUFjRCxLQWhCRCxNQWdCTztBQUNMLFdBQUtBLEdBQUwsQ0FDRSxvRUFERjtBQUdBLGFBQU9oQyxnQkFDTCxLQUFLZ0MsR0FEQSxFQUVMLEtBQUthLFFBRkEsRUFHTCxLQUFLZixPQUFMLENBQWFnQixVQUhSLEVBSUxyRCxJQUpLLEVBS0wrQyxJQUxLLENBS0FYLG9CQUxBLENBQVA7QUFNRDtBQUNGO0FBeENrQixDIiwiZmlsZSI6ImJpdEJ1Y2tldC5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBnaXR1cmwgZnJvbSBcImdpdC11cmwtcGFyc2VcIjtcbmltcG9ydCB7IHRvTWFya2Rvd24sIHRvVGV4dFRhYmxlIH0gZnJvbSBcIi4vY29tcGFyZVwiO1xuY29uc3QgYnByID0gcmVxdWlyZShcImJpdGJ1Y2tldC1wdWxsLXJlcXVlc3RcIik7XG5cbmZ1bmN0aW9uIHRvVGFnKHRhZ3MsIHZlcnNpb24pIHtcbiAgbGV0IHYgPSBgdiR7dmVyc2lvbn1gO1xuICBpZiAodGFncy5oYXModikpIHtcbiAgICByZXR1cm4gdjtcbiAgfVxuICByZXR1cm4gdGFncy5oYXModmVyc2lvbikgJiYgdmVyc2lvbjtcbn1cblxuZnVuY3Rpb24gZGlmZlVSTChjbSwgdG8pIHtcbiAgaWYgKGNtLnJlcG8pIHtcbiAgICBpZiAoY20uY3VycmVudCA9PT0gdG8pIHtcbiAgICAgIGxldCB0YWcgPSB0b1RhZyhjbS50YWdzLCBjbS5jdXJyZW50KTtcbiAgICAgIHJldHVybiB0YWcgJiYgYCR7Y20ucmVwb30vdHJlZS8ke3RhZ31gO1xuICAgIH1cbiAgICBsZXQgZnQgPSB0b1RhZyhjbS50YWdzLCBjbS5jdXJyZW50KTtcbiAgICBsZXQgdHQgPSB0b1RhZyhjbS50YWdzLCB0byk7XG4gICAgcmV0dXJuIGZ0ICYmIHR0ICYmIGAke2NtLnJlcG99L2NvbXBhcmUvJHtmdH0uLi4ke3R0fWA7XG4gIH1cbiAgcmV0dXJuIFwiXCI7XG59XG5cbmZ1bmN0aW9uIHZlcnNpb25SYW5nZShjdXJyZW50LCB0bykge1xuICBpZiAoY3VycmVudCA9PT0gdG8pIHtcbiAgICByZXR1cm4gY3VycmVudDtcbiAgfVxuICByZXR1cm4gYCR7Y3VycmVudH0uLi4ke3RvfWA7XG59XG5cbmNsYXNzIENvbXBhcmVNb2RlbCB7XG4gIGNvbnN0cnVjdG9yKGEpIHtcbiAgICBbdGhpcy5uYW1lLCB0aGlzLmN1cnJlbnQsIHRoaXMud2FudGVkLCB0aGlzLmxhdGVzdCwgdGhpcy5wYWNrYWdlVHlwZV0gPSBhO1xuICAgIHRoaXMucmVwbyA9IFwiXCI7XG4gICAgdGhpcy5ob21lcGFnZSA9IFwiXCI7XG4gICAgdGhpcy50YWdzID0gbmV3IFNldCgpO1xuICB9XG5cbiAgcmFuZ2VXYW50ZWQoKSB7XG4gICAgcmV0dXJuIHZlcnNpb25SYW5nZSh0aGlzLmN1cnJlbnQsIHRoaXMud2FudGVkKTtcbiAgfVxuXG4gIHJhbmdlTGF0ZXN0KCkge1xuICAgIHJldHVybiB2ZXJzaW9uUmFuZ2UodGhpcy5jdXJyZW50LCB0aGlzLmxhdGVzdCk7XG4gIH1cblxuICBkaWZmV2FudGVkVVJMKCkge1xuICAgIHJldHVybiBkaWZmVVJMKHRoaXMsIHRoaXMud2FudGVkKTtcbiAgfVxuXG4gIGRpZmZMYXRlc3RVUkwoKSB7XG4gICAgcmV0dXJuIGRpZmZVUkwodGhpcywgdGhpcy5sYXRlc3QpO1xuICB9XG5cbiAgdG9NYXJrZG93bigpIHtcbiAgICByZXR1cm4gdG9NYXJrZG93bih0aGlzKTtcbiAgfVxuXG4gIHRvVGV4dFRhYmxlKCkge1xuICAgIHJldHVybiB0b1RleHRUYWJsZSh0aGlzKTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiB0b0NvbXBhcmVNb2RlbHMoZGlmZikge1xuICByZXR1cm4gbmV3IE1hcChcbiAgICBkaWZmLm1hcChkID0+IHtcbiAgICAgIGxldCBjID0gbmV3IENvbXBhcmVNb2RlbChkKTtcbiAgICAgIHJldHVybiBbYy5uYW1lLCBjXTtcbiAgICB9KVxuICApO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyB7XG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMsIHJlbW90ZSkge1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy5MT0cgPSBvcHRpb25zLmxvZ2dlcjtcbiAgICB0aGlzLnVybCA9IGdpdHVybChyZW1vdGUpO1xuICB9XG5cbiAgcHVsbFJlcXVlc3QoYmFzZUJyYW5jaCwgbmV3QnJhbmNoLCBkaWZmKSB7XG4gICAgdGhpcy5MT0coXG4gICAgICBgcHJlcGFyZSBQdWxsUmVxdWVzdCAke3RoaXMudXJsLnRvU3RyaW5nKFxuICAgICAgICBcImh0dHBzXCJcbiAgICAgICl9ICR7YmFzZUJyYW5jaH0uLi4ke25ld0JyYW5jaH1gXG4gICAgKTtcbiAgICBpZiAodGhpcy5vcHRpb25zLmV4ZWN1dGUpIHtcbiAgICAgIHRoaXMuTE9HKFwiQ3JlYXRlIE1hcmtkb3duIFJlcG9ydCBmb3IgUHVsbFJlcXVlc3QuXCIpO1xuICAgICAgcmV0dXJuIHRvQ29tcGFyZU1vZGVscyhkaWZmKVxuICAgICAgICAudGhlbih0b01hcmtkb3duKVxuICAgICAgICAudGhlbihtYXJrZG93biA9PiB7XG4gICAgICAgICAgdGhpcy5MT0coXCJCRUdJTiBTZW5kIFB1bGxSZXF1ZXN0LlwiKTtcbiAgICAgICAgICBicHIuY3JlYXRlKFxuICAgICAgICAgICAgdGhpcy51cmwub3duZXIsIC8vIHJlcG9zaXRvcnkgdXNlclxuICAgICAgICAgICAgdGhpcy51cmwubmFtZSwgLy8gcmVwb3NpdG9yeSBuYW1lXG4gICAgICAgICAgICBgdXBkYXRlIGRlcGVuZGVuY2llcyBhdCAke3RoaXMub3B0aW9ucy5ub3d9YCwgLy8gdGl0bGVcbiAgICAgICAgICAgIG1hcmtkb3duLCAvLyBkZXNjcmlwdGlvblxuICAgICAgICAgICAgbmV3QnJhbmNoLCAvLyBzb3VyY2UgYnJhbmNoXG4gICAgICAgICAgICBiYXNlQnJhbmNoIC8vIGRlc3RpbmF0aW9uIGJyYW5jaFxuICAgICAgICAgICk7XG4gICAgICAgICAgdGhpcy5MT0coXCJFTkQgICBTZW5kIFB1bGxSZXF1ZXN0LlwiKTtcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuTE9HKFxuICAgICAgICBcIlNlbmRpbmcgUHVsbFJlcXVlc3QgaXMgc2tpcHBlZCBiZWNhdXNlIC0tZXhlY3V0ZSBpcyBub3Qgc3BlY2lmaWVkLlwiXG4gICAgICApO1xuICAgICAgcmV0dXJuIHRvQ29tcGFyZU1vZGVscyhcbiAgICAgICAgdGhpcy5MT0csXG4gICAgICAgIHRoaXMub3JpZ2luYWwsXG4gICAgICAgIHRoaXMub3B0aW9ucy53b3JraW5nZGlyLFxuICAgICAgICBkaWZmXG4gICAgICApLnRoZW4odG9UZXh0VGFibGUpO1xuICAgIH1cbiAgfVxufVxuIl19