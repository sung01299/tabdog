function createNavigationStore() {
  let currentPage = $state('tabs');

  return {
    get currentPage() { return currentPage; },

    switchTo(page) {
      if (page === 'devices') return;
      currentPage = page;
    },

    get showSearchBar() {
      return currentPage === 'tabs';
    },
  };
}

export const navigationStore = createNavigationStore();
