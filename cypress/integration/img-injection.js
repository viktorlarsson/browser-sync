describe('Reloading a IMG file', function() {
    beforeEach(function() {
        cy.visit(Cypress.env('BS_URL') + '/images.html');
    });
    it('should reload single <img src>', function() {
        cy.exec('touch test/fixtures/**/cam-secure.png');
        cy.wait(500);
        cy.get('[id="img-src-attr"]').should($link => {
            const url = new URL($link.attr('src'));
            expect(url.search).to.contain('?browsersync=');
        });
        cy.get('[id="img-style"]').should($link => {
            const urlFromStyle = $link.css('backgroundImage').split('"').slice(1, -1);
            const url = new URL(urlFromStyle);
            expect(url.search).not.to.contain('?browsersync=');
        });
    });
    it('should reload single style backgroundImage style property', function() {
        cy.exec('touch test/fixtures/**/cam-secure-02.png');
        cy.wait(500);
        cy.get('[id="img-src-attr"]').should($link => {
            expect($link.attr('src')).not.to.contain('?browsersync=');
        });
        cy.get('[id="img-style"]').should($link => {
            const urlFromStyle = $link.css('backgroundImage').split('"').slice(1, -1);
            const url = new URL(urlFromStyle);
            expect(url.search).to.contain('?browsersync=');
        });
    });
    it('should reload both images', function() {
        cy.exec('touch test/fixtures/**/*.png');
        cy.wait(500);
        cy.get('[id="img-src-attr"]').should($link => {
            const url = new URL($link.attr('src'));
            expect(url.search).to.contain('?browsersync=');
        });
        cy.get('[id="img-style"]').should($link => {
            const urlFromStyle = $link.css('backgroundImage').split('"').slice(1, -1);
            const url = new URL(urlFromStyle);
            expect(url.search).to.contain('?browsersync=');
        });
    });
});